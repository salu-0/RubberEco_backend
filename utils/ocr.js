const Tesseract = require('tesseract.js');
const fs = require('fs');
const path = require('path');

function normalizeText(input) {
  if (!input) return '';
  // Preserve line breaks; only collapse spaces and tabs. Also trim spaces around newlines.
  return String(input)
    .replace(/[_:]/g, ' ')
    .replace(/\r\n/g, '\n')
    .replace(/[ \t]+/g, ' ')
    .replace(/\n[ \t]+/g, '\n')
    .replace(/[ \t]+\n/g, '\n')
    .trim();
}

function extractFieldsFromText(text) {
  const cleaned = normalizeText(text).toUpperCase();

  // Name extraction: prefer explicit label; fallback to first plausible name-like line
  let name = '';
  const nameMatch = cleaned.match(/\bNAME\b\s*[:\-]?\s*([A-Z\s\.]{2,})/);
  if (nameMatch) {
    name = nameMatch[1].replace(/\s{2,}/g, ' ').trim();
  } else {
    const lines = cleaned.split(/\n|\r/).map(l => l.trim()).filter(Boolean);
    const candidate = lines.find(l =>
      /^[A-Z][A-Z\s\.]{3,}$/.test(l) && !/FATHER|MOTHER|HUSBAND|WIFE|ADDRESS|GOVERNMENT|REPUBLIC|INDIA|UNION|MINISTRY|DATE|BIRTH|DOB|SIGNATURE|ID|NUMBER/.test(l)
    );
    if (candidate) name = candidate.replace(/\s{2,}/g, ' ').trim();

    // Fallback 2: if still no name, take the line immediately preceding a DOB line
    if (!name) {
      const dobLineIndex = lines.findIndex(l => /(DOB|DATE OF BIRTH|BIRTH)\s*[:\-]?/.test(l));
      if (dobLineIndex > 0) {
        const prev = lines[dobLineIndex - 1];
        if (prev && !/(FEMALE|MALE|OTHER|GOVERNMENT|INDIA|ADDRESS|SIGNATURE|AUTHORITY)/.test(prev)) {
          name = prev.replace(/\s{2,}/g, ' ').trim();
        }
      }
    }
  }

  // We do not extract ID numbers anymore for privacy/simplicity

  // DOB extraction: digits and month names
  const dobPatterns = [
    /(DOB|DATE OF BIRTH|BIRTH)\s*[:\-]?\s*(\d{2}[\/\-]\d{2}[\/\-]\d{4})/,
    /(DOB|DATE OF BIRTH|BIRTH)\s*[:\-]?\s*(\d{4}[\/\-]\d{2}[\/\-]\d{2})/,
    /(DOB|DATE OF BIRTH|BIRTH)\s*[:\-]?\s*(\d{1,2}[\s\-\.](JAN|FEB|MAR|APR|MAY|JUN|JUL|AUG|SEP|SEPT|OCT|NOV|DEC)[\s\-\.]\d{4})/
  ];
  let dob = '';
  for (const re of dobPatterns) {
    const m = cleaned.match(re);
    if (m && m[2]) { dob = m[2].trim(); break; }
  }
  if (!dob) {
    // Fallback: any date-like token in text
    const anyDate = cleaned.match(/\b(\d{2}[\/\-]\d{2}[\/\-]\d{4}|\d{4}[\/\-]\d{2}[\/\-]\d{2}|\d{1,2}[\s\-\.](JAN|FEB|MAR|APR|MAY|JUN|JUL|AUG|SEP|SEPT|OCT|NOV|DEC)[\s\-\.]\d{4})\b/);
    if (anyDate) dob = anyDate[1].trim();
  }

  // Additional name heuristic: if a line contains DOB, take the text before DOB keywords as name
  if (!name) {
    const lines = cleaned.split(/\n|\r/).map(l => l.trim()).filter(Boolean);
    const dobIdx = lines.findIndex(l => /(DOB|DATE OF BIRTH|BIRTH)\s*[:\-]?/.test(l));
    if (dobIdx >= 0) {
      const line = lines[dobIdx];
      const m = line.match(/^([A-Z\s\.]{2,}?)(?:\s{1,})(?:DOB|DATE OF BIRTH|BIRTH)\b/);
      if (m && m[1]) {
        const candidate = m[1].replace(/\s{2,}/g, ' ').trim();
        if (candidate && !/(FEMALE|MALE|OTHER|ADDRESS|GOVERNMENT|INDIA)/.test(candidate)) {
          name = candidate;
        }
      }
    }
  }

  const idNumber = '';
  return { name, dob, idNumber };
}

function normalizeName(name) {
  return normalizeText(name).toUpperCase().replace(/\./g, '');
}

function namesRoughlyMatch(a, b) {
  const na = normalizeName(a);
  const nb = normalizeName(b);
  if (!na || !nb) return false;
  if (na === nb) return true;
  if (na.includes(nb) || nb.includes(na)) return true;

  const tokenize = (s) => s.split(' ').map(t => t.trim()).filter(t => t.length >= 2);
  const aParts = Array.from(new Set(tokenize(na)));
  const bParts = Array.from(new Set(tokenize(nb)));
  if (aParts.length === 0 || bParts.length === 0) return false;

  const overlapCount = aParts.filter(p => bParts.includes(p)).length;
  const jaccard = overlapCount / (new Set([...aParts, ...bParts]).size);
  const coverage = overlapCount / Math.max(aParts.length, bParts.length);

  // Accept if at least one token overlaps and either coverage >= 0.5 or jaccard >= 0.3
  return overlapCount >= 1 && (coverage >= 0.5 || jaccard >= 0.3);
}

function normalizeDob(dob) {
  if (!dob) return '';
  // Accept incoming as ISO (from form) or DD/MM/YYYY; return YYYY-MM-DD
  const s = String(dob).trim();
  const m1 = s.match(/^(\d{2})[\/\-](\d{2})[\/\-](\d{4})$/);
  if (m1) {
    const [ , dd, mm, yyyy ] = m1;
    return `${yyyy}-${mm}-${dd}`;
  }
  const m2 = s.match(/^(\d{4})[\/\-](\d{2})[\/\-](\d{2})$/);
  if (m2) return `${m2[1]}-${m2[2]}-${m2[3]}`;
  const m3 = s.match(/^(\d{1,2})[\s\-\.](JAN|FEB|MAR|APR|MAY|JUN|JUL|AUG|SEP|SEPT|OCT|NOV|DEC)[\s\-\.]([0-9]{4})$/i);
  if (m3) {
    const dd = String(m3[1]).padStart(2, '0');
    const monthMap = { JAN:'01', FEB:'02', MAR:'03', APR:'04', MAY:'05', JUN:'06', JUL:'07', AUG:'08', SEP:'09', SEPT:'09', OCT:'10', NOV:'11', DEC:'12' };
    const mm = monthMap[m3[2].toUpperCase()] || '01';
    const yyyy = m3[3];
    return `${yyyy}-${mm}-${dd}`;
  }
  // Try Date parse
  const d = new Date(s);
  if (!isNaN(d)) {
    const yyyy = d.getFullYear();
    const mm = String(d.getMonth() + 1).padStart(2, '0');
    const dd = String(d.getDate()).padStart(2, '0');
    return `${yyyy}-${mm}-${dd}`;
  }
  return '';
}

async function runTesseractOnImage(imagePath) {
  if (!fs.existsSync(imagePath)) {
    throw new Error('File not found for OCR');
  }
  const { data } = await Tesseract.recognize(imagePath, 'eng', {
    logger: () => {}
  });
  return data;
}

async function ocrIdProofAndValidate({ filePath, expectedName, expectedDob, expectedIdNumber }) {
  const result = {
    status: 'error',
    confidence: 0,
    extracted: { name: '', dob: '', idNumber: '' },
    matched: { name: false, dob: false, idNumber: false },
    rawText: '',
    notes: ''
  };

  try {
    const tData = await runTesseractOnImage(filePath);
    result.rawText = tData.text || '';
    result.confidence = typeof tData.confidence === 'number' ? tData.confidence : 0;

    const extracted = extractFieldsFromText(result.rawText);
    result.extracted = extracted;

    const expectedDobNorm = normalizeDob(expectedDob);
    const extractedDobNorm = normalizeDob(extracted.dob);

    result.matched.name = namesRoughlyMatch(extracted.name, expectedName);
    result.matched.dob = !!(expectedDobNorm && extractedDobNorm && expectedDobNorm === extractedDobNorm);

    // If name couldn't be extracted but DOB matches confidently, allow pass
    const extractedNameAvailable = !!extracted.name && extracted.name.length >= 2;
    const pass = (result.matched.name && result.matched.dob) || (!extractedNameAvailable && result.matched.dob);
    result.status = pass ? 'passed' : 'failed';
    result.verifiedAt = new Date();
    result.notes = pass ? 'Basic OCR verification passed' : 'Mismatch between OCR and provided details';
  } catch (err) {
    result.status = 'error';
    result.notes = err.message || 'OCR error';
  }

  return result;
}

module.exports = {
  ocrIdProofAndValidate
};


