const nodemailer = require('nodemailer');
const { google } = require('googleapis');

const OAuth2 = google.auth.OAuth2;

// Configure email transporter with OAuth2
const createEmailTransporter = () => {
  // Try OAuth2 first if refresh token is available
  if (process.env.GOOGLE_REFRESH_TOKEN) {
    try {
      const oauth2Client = new OAuth2(
        process.env.GOOGLE_CLIENT_ID,
        process.env.GOOGLE_CLIENT_SECRET,
        'https://developers.google.com/oauthplayground'
      );

      oauth2Client.setCredentials({
        refresh_token: process.env.GOOGLE_REFRESH_TOKEN
      });

      const accessToken = oauth2Client.getAccessToken();

      return nodemailer.createTransport({
        service: 'gmail',
        auth: {
          type: 'OAuth2',
          user: process.env.EMAIL_USER,
          clientId: process.env.GOOGLE_CLIENT_ID,
          clientSecret: process.env.GOOGLE_CLIENT_SECRET,
          refreshToken: process.env.GOOGLE_REFRESH_TOKEN,
          accessToken: accessToken
        },
        tls: {
          rejectUnauthorized: false
        }
      });
    } catch (error) {
      console.log('⚠️ OAuth2 failed, falling back to basic auth:', error.message);
    }
  }

  // Fallback to basic authentication
  console.log('📧 Using basic authentication for email');
  return nodemailer.createTransport({
    service: 'gmail',
    auth: {
      user: process.env.EMAIL_USER,
      pass: process.env.EMAIL_PASS
    },
    tls: {
      rejectUnauthorized: false
    }
  });
};

// Send application confirmation email to staff applicant
const sendStaffApplicationConfirmation = async (applicantData) => {
  try {
    console.log('📧 Sending application confirmation email to:', applicantData.email);

    const transporter = createEmailTransporter();

    const confirmationMessage = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; background-color: #f9f9f9;">
        <div style="background-color: white; padding: 30px; border-radius: 10px; box-shadow: 0 2px 10px rgba(0,0,0,0.1);">
          <div style="text-align: center; margin-bottom: 30px;">
            <h1 style="color: #22c55e; margin: 0; font-size: 28px;">🌿 RubberEco</h1>
            <p style="color: #666; margin: 5px 0 0 0; font-size: 16px;">Sustainable Rubber Plantation Management</p>
          </div>

          <h2 style="color: #333; margin-bottom: 20px;">Application Received Successfully! ✅</h2>

          <p style="color: #555; line-height: 1.6; margin-bottom: 20px;">
            Dear <strong>${applicantData.fullName}</strong>,
          </p>

          <p style="color: #555; line-height: 1.6; margin-bottom: 20px;">
            Thank you for your interest in joining the RubberEco team! We have successfully received your application for the position of <strong>${applicantData.applyForPosition}</strong>.
          </p>

          <div style="background-color: #f0f9ff; padding: 20px; border-radius: 8px; margin: 20px 0; border-left: 4px solid #22c55e;">
            <h3 style="color: #22c55e; margin: 0 0 10px 0;">Application Details:</h3>
            <p style="margin: 5px 0; color: #555;"><strong>Application ID:</strong> ${applicantData.applicationId}</p>
            <p style="margin: 5px 0; color: #555;"><strong>Position Applied:</strong> ${applicantData.applyForPosition}</p>
            <p style="margin: 5px 0; color: #555;"><strong>Submitted Date:</strong> ${new Date(applicantData.submittedAt).toLocaleDateString()}</p>
            <p style="margin: 5px 0; color: #555;"><strong>Status:</strong> Under Review</p>
          </div>

          <p style="color: #555; line-height: 1.6; margin-bottom: 20px;">
            Our administrative team will review your application and supporting documents. You can expect to hear back from us within <strong>3-5 business days</strong>.
          </p>

          <p style="color: #555; line-height: 1.6; margin-bottom: 20px;">
            If you have any questions or need to update your application, please contact us at <a href="mailto:admin@rubbereco.com" style="color: #22c55e;">admin@rubbereco.com</a> with your application ID.
          </p>

          <div style="text-align: center; margin: 30px 0;">
            <p style="color: #888; font-size: 14px;">
              Thank you for choosing RubberEco. We look forward to potentially welcoming you to our team!
            </p>
          </div>

          <div style="border-top: 1px solid #eee; padding-top: 20px; margin-top: 30px; text-align: center;">
            <p style="color: #888; font-size: 12px; margin: 0;">
              This is an automated message from RubberEco. Please do not reply to this email.
            </p>
            <p style="color: #888; font-size: 12px; margin: 5px 0 0 0;">
              © 2024 RubberEco. All rights reserved.
            </p>
          </div>
        </div>
      </div>
    `;

    const plainTextMessage = `
      RubberEco - Application Received Successfully!

      Dear ${applicantData.fullName},

      Thank you for your interest in joining the RubberEco team! We have successfully received your application for the position of ${applicantData.applyForPosition}.

      Application Details:
      - Application ID: ${applicantData.applicationId}
      - Position Applied: ${applicantData.applyForPosition}
      - Submitted Date: ${new Date(applicantData.submittedAt).toLocaleDateString()}
      - Status: Under Review

      Our administrative team will review your application and supporting documents. You can expect to hear back from us within 3-5 business days.

      If you have any questions or need to update your application, please contact us at admin@rubbereco.com with your application ID.

      Thank you for choosing RubberEco. We look forward to potentially welcoming you to our team!

      This is an automated message from RubberEco. Please do not reply to this email.
      © 2024 RubberEco. All rights reserved.
    `.replace(/\s+/g, ' ').trim();

    const result = await transporter.sendMail({
      from: `"RubberEco Team" <${process.env.EMAIL_USER}>`,
      to: applicantData.email,
      subject: `✅ Application Received - ${applicantData.applicationId} | RubberEco`,
      html: confirmationMessage,
      text: plainTextMessage
    });

    console.log(`✅ Application confirmation email sent successfully to: ${applicantData.email}`);
    console.log('Email message ID:', result.messageId);

    return {
      success: true,
      message: 'Application confirmation email sent successfully',
      messageId: result.messageId
    };

  } catch (error) {
    console.error('❌ Failed to send application confirmation email:', error);
    return {
      success: false,
      message: 'Failed to send confirmation email',
      error: error.message
    };
  }
};

// Send welcome email to new staff member with login credentials
const sendStaffWelcomeEmail = async (staffData, adminData, generatedPassword) => {
  try {
    console.log('🔍 Email function called with:');
    console.log('- Staff email:', staffData.email);
    console.log('- Generated password:', generatedPassword);
    console.log('- Password exists:', !!generatedPassword);
    console.log('- Password length:', generatedPassword ? generatedPassword.length : 0);
    console.log('- Password type:', typeof generatedPassword);
    console.log('- Password JSON:', JSON.stringify(generatedPassword));

    // Test the template interpolation
    console.log('🔍 Testing template interpolation:');
    console.log('- Template test:', 'Password: ' + generatedPassword);
    console.log('- Fallback test:', generatedPassword || 'FALLBACK_PASSWORD');

    // Check if email configuration is available
    if (!process.env.EMAIL_USER || !process.env.EMAIL_PASS) {
      console.log('⚠️ Email configuration not found, skipping welcome email');
      return { success: false, message: 'Email configuration not available' };
    }

    const transporter = createEmailTransporter();
    
    // Verify connection
    await transporter.verify();
    console.log('✅ SMTP connection verified for staff welcome email');

    // Create ATTRACTIVE email content with professional styling
    const welcomeMessage = `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Welcome to RubberEco</title>
      </head>
      <body style="margin: 0; padding: 0; font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; background-color: #f5f7fa; line-height: 1.6;">

        <!-- Main Container -->
        <div style="max-width: 600px; margin: 20px auto; background-color: #ffffff; border-radius: 12px; box-shadow: 0 4px 20px rgba(0,0,0,0.1); overflow: hidden;">

          <!-- Header Section -->
          <div style="background: linear-gradient(135deg, #2563eb 0%, #1d4ed8 100%); padding: 30px 20px; text-align: center; color: white;">
            <div style="font-size: 32px; margin-bottom: 10px;">🌱</div>
            <h1 style="margin: 0; font-size: 28px; font-weight: bold;">RubberEco</h1>
            <p style="margin: 5px 0 0 0; font-size: 16px; opacity: 0.9;">Sustainable Rubber Management System</p>
          </div>

          <!-- Password Alert Section -->
          <div style="background: linear-gradient(135deg, #10b981 0%, #059669 100%); padding: 25px 20px; text-align: center; color: white; border-bottom: 3px solid #047857;">
            <div style="font-size: 24px; margin-bottom: 10px;">🔑</div>
            <h2 style="margin: 0; font-size: 22px; font-weight: bold;">YOUR LOGIN PASSWORD</h2>
            <div style="background: rgba(255,255,255,0.2); margin: 15px auto; padding: 15px 25px; border-radius: 8px; font-family: 'Courier New', monospace; font-size: 24px; font-weight: bold; letter-spacing: 3px; max-width: 300px; border: 2px solid rgba(255,255,255,0.3);">
              ${generatedPassword}
            </div>
            <p style="margin: 10px 0 0 0; font-size: 14px; opacity: 0.9;">Save this password securely!</p>
          </div>

          <!-- Welcome Section -->
          <div style="padding: 30px 20px;">
            <h2 style="color: #1f2937; margin: 0 0 20px 0; font-size: 24px; text-align: center;">
              Welcome to the Team, <span style="color: #2563eb;">${staffData.name}</span>! 🎉
            </h2>

            <p style="color: #6b7280; font-size: 16px; text-align: center; margin-bottom: 30px;">
              You have been successfully added to our RubberEco staff management system. We're excited to have you on board!
            </p>

            <!-- Login Details Card -->
            <div style="background: #f8fafc; border: 2px solid #e2e8f0; border-radius: 10px; padding: 25px; margin: 20px 0;">
              <h3 style="color: #2563eb; margin: 0 0 20px 0; font-size: 20px; text-align: center; border-bottom: 2px solid #e2e8f0; padding-bottom: 10px;">
                🔐 Login Credentials
              </h3>

              <div style="margin-bottom: 15px;">
                <strong style="color: #374151; display: inline-block; width: 80px;">Email:</strong>
                <span style="color: #1f2937; font-family: 'Courier New', monospace; background: #e5e7eb; padding: 4px 8px; border-radius: 4px;">${staffData.email}</span>
              </div>

              <div style="margin-bottom: 15px;">
                <strong style="color: #374151; display: inline-block; width: 80px;">Password:</strong>
                <span style="color: #dc2626; font-family: 'Courier New', monospace; background: #fef2f2; padding: 4px 8px; border-radius: 4px; font-weight: bold;">${generatedPassword}</span>
              </div>

              <div style="margin-bottom: 20px;">
                <strong style="color: #374151; display: inline-block; width: 80px;">Login URL:</strong>
                <a href="http://localhost:5175/login" style="color: #2563eb; text-decoration: none; font-weight: 500;">http://localhost:5175/login</a>
              </div>

              <div style="background: #fef3c7; border-left: 4px solid #f59e0b; padding: 12px 15px; border-radius: 6px;">
                <p style="margin: 0; color: #92400e; font-size: 14px;">
                  <strong>⚠️ Security Note:</strong> Please keep your password secure and consider changing it after your first login.
                </p>
              </div>
            </div>

            <!-- Staff Information Card -->
            <div style="background: #f0f9ff; border: 2px solid #bae6fd; border-radius: 10px; padding: 25px; margin: 20px 0;">
              <h3 style="color: #0369a1; margin: 0 0 20px 0; font-size: 20px; text-align: center; border-bottom: 2px solid #bae6fd; padding-bottom: 10px;">
                👤 Your Staff Information
              </h3>

              <div style="display: grid; gap: 12px;">
                <div style="display: flex; justify-content: space-between; padding: 8px 0; border-bottom: 1px solid #e0f2fe;">
                  <strong style="color: #0f172a;">Name:</strong>
                  <span style="color: #1e293b;">${staffData.name}</span>
                </div>

                <div style="display: flex; justify-content: space-between; padding: 8px 0; border-bottom: 1px solid #e0f2fe;">
                  <strong style="color: #0f172a;">Email:</strong>
                  <span style="color: #1e293b;">${staffData.email}</span>
                </div>

                <div style="display: flex; justify-content: space-between; padding: 8px 0; border-bottom: 1px solid #e0f2fe;">
                  <strong style="color: #0f172a;">Phone:</strong>
                  <span style="color: #1e293b;">${staffData.phone}</span>
                </div>

                <div style="display: flex; justify-content: space-between; padding: 8px 0; border-bottom: 1px solid #e0f2fe;">
                  <strong style="color: #0f172a;">Role:</strong>
                  <span style="color: #1e293b; text-transform: capitalize;">${staffData.role.replace('_', ' ')}</span>
                </div>

                <div style="display: flex; justify-content: space-between; padding: 8px 0; border-bottom: 1px solid #e0f2fe;">
                  <strong style="color: #0f172a;">Department:</strong>
                  <span style="color: #1e293b;">${staffData.department}</span>
                </div>

                <div style="display: flex; justify-content: space-between; padding: 8px 0;">
                  <strong style="color: #0f172a;">Location:</strong>
                  <span style="color: #1e293b;">${staffData.location}</span>
                </div>
              </div>
            </div>

            <!-- Next Steps Section -->
            <div style="background: #fefce8; border: 2px solid #fde047; border-radius: 10px; padding: 25px; margin: 20px 0;">
              <h3 style="color: #a16207; margin: 0 0 20px 0; font-size: 20px; text-align: center; border-bottom: 2px solid #fde047; padding-bottom: 10px;">
                🚀 Next Steps
              </h3>

              <div style="counter-reset: step-counter;">
                <div style="counter-increment: step-counter; display: flex; align-items: center; margin-bottom: 15px; padding: 12px; background: white; border-radius: 8px; border-left: 4px solid #eab308;">
                  <div style="background: #eab308; color: white; width: 24px; height: 24px; border-radius: 50%; display: flex; align-items: center; justify-content: center; font-weight: bold; margin-right: 15px; font-size: 12px;">1</div>
                  <span style="color: #374151;">Use the credentials above to login to your account</span>
                </div>

                <div style="counter-increment: step-counter; display: flex; align-items: center; margin-bottom: 15px; padding: 12px; background: white; border-radius: 8px; border-left: 4px solid #eab308;">
                  <div style="background: #eab308; color: white; width: 24px; height: 24px; border-radius: 50%; display: flex; align-items: center; justify-content: center; font-weight: bold; margin-right: 15px; font-size: 12px;">2</div>
                  <span style="color: #374151;">Access your personalized staff dashboard</span>
                </div>

                <div style="counter-increment: step-counter; display: flex; align-items: center; margin-bottom: 15px; padding: 12px; background: white; border-radius: 8px; border-left: 4px solid #eab308;">
                  <div style="background: #eab308; color: white; width: 24px; height: 24px; border-radius: 50%; display: flex; align-items: center; justify-content: center; font-weight: bold; margin-right: 15px; font-size: 12px;">3</div>
                  <span style="color: #374151;">Complete your profile setup and preferences</span>
                </div>

                <div style="counter-increment: step-counter; display: flex; align-items: center; padding: 12px; background: white; border-radius: 8px; border-left: 4px solid #eab308;">
                  <div style="background: #eab308; color: white; width: 24px; height: 24px; border-radius: 50%; display: flex; align-items: center; justify-content: center; font-weight: bold; margin-right: 15px; font-size: 12px;">4</div>
                  <span style="color: #374151;">Start managing your tasks and responsibilities</span>
                </div>
              </div>
            </div>

            <!-- CTA Button -->
            <div style="text-align: center; margin: 30px 0;">
              <a href="http://localhost:5175/login" style="display: inline-block; background: linear-gradient(135deg, #2563eb 0%, #1d4ed8 100%); color: white; text-decoration: none; padding: 15px 40px; border-radius: 8px; font-weight: bold; font-size: 16px; box-shadow: 0 4px 12px rgba(37, 99, 235, 0.3); transition: all 0.3s ease;">
                🚀 Login to Your Dashboard
              </a>
            </div>

            <!-- Support Section -->
            <div style="background: #f1f5f9; border-radius: 8px; padding: 20px; text-align: center; margin-top: 30px;">
              <p style="color: #64748b; margin: 0 0 10px 0; font-size: 14px;">
                Need help? Have questions? We're here to support you!
              </p>
              <p style="color: #475569; margin: 0; font-size: 14px;">
                Contact your administrator or reach out to our support team.
              </p>
            </div>
          </div>

          <!-- Footer -->
          <div style="background: #1f2937; color: #9ca3af; padding: 25px 20px; text-align: center;">
            <div style="margin-bottom: 15px;">
              <div style="font-size: 24px; margin-bottom: 8px;">🌱</div>
              <h4 style="margin: 0; color: #f9fafb; font-size: 18px;">RubberEco Team</h4>
              <p style="margin: 5px 0 0 0; font-size: 14px;">Sustainable Rubber Management System</p>
            </div>

            <div style="border-top: 1px solid #374151; padding-top: 15px; font-size: 12px;">
              <p style="margin: 0;">© 2025 RubberEco. All rights reserved.</p>
              <p style="margin: 5px 0 0 0;">This is an automated message. Please do not reply to this email.</p>
            </div>
          </div>
        </div>
      </body>
      </html>
    `;

    // Create ATTRACTIVE plain text version with PASSWORD FIRST
    const plainTextMessage = `
═══════════════════════════════════════════════════════════════
🌱 RUBBERECO - SUSTAINABLE RUBBER MANAGEMENT SYSTEM 🌱
═══════════════════════════════════════════════════════════════

🔑 YOUR LOGIN PASSWORD: ${generatedPassword}
═══════════════════════════════════════════════════════════════

Welcome to the team, ${staffData.name}! 🎉

You have been successfully added to our RubberEco staff management
system. We're excited to have you on board!

🔐 LOGIN CREDENTIALS:
───────────────────────────────────────────────────────────────
Email:    ${staffData.email}
Password: ${generatedPassword}
Login:    http://localhost:5175/login

⚠️  SECURITY NOTE: Please keep your password secure and consider
    changing it after your first login.

👤 YOUR STAFF INFORMATION:
───────────────────────────────────────────────────────────────
Name:       ${staffData.name}
Email:      ${staffData.email}
Phone:      ${staffData.phone}
Role:       ${staffData.role.replace('_', ' ').toUpperCase()}
Department: ${staffData.department}
Location:   ${staffData.location}

🚀 NEXT STEPS:
───────────────────────────────────────────────────────────────
1. Use the credentials above to login to your account
2. Access your personalized staff dashboard
3. Complete your profile setup and preferences
4. Start managing your tasks and responsibilities

💡 NEED HELP?
───────────────────────────────────────────────────────────────
Have questions? We're here to support you!
Contact your administrator or reach out to our support team.

═══════════════════════════════════════════════════════════════
🌱 RubberEco Team
Sustainable Rubber Management System

© 2025 RubberEco. All rights reserved.
This is an automated message. Please do not reply to this email.
═══════════════════════════════════════════════════════════════
    `;

    // Log email content for debugging
    console.log('🔍 Email content preview:');
    console.log('- HTML contains password:', welcomeMessage.includes(generatedPassword));
    console.log('- Plain text contains password:', plainTextMessage.includes(generatedPassword));
    console.log('- HTML snippet around password:', welcomeMessage.substring(welcomeMessage.indexOf('Password:'), welcomeMessage.indexOf('Password:') + 100));
    console.log('- Plain text snippet:', plainTextMessage.substring(plainTextMessage.indexOf('Password:'), plainTextMessage.indexOf('Password:') + 50));

    // Send the email with both HTML and plain text
    const result = await transporter.sendMail({
      from: `"RubberEco Team" <${process.env.EMAIL_USER}>`,
      to: staffData.email,
      subject: `🔑 RubberEco Login Password: ${generatedPassword} - Welcome ${staffData.name}`,
      html: welcomeMessage,
      text: plainTextMessage
    });

    console.log(`✅ Welcome email sent successfully to: ${staffData.email}`);
    console.log('Email message ID:', result.messageId);

    return {
      success: true,
      message: 'Welcome email sent successfully',
      messageId: result.messageId
    };

  } catch (error) {
    console.error('❌ Failed to send staff welcome email:', error);
    return {
      success: false,
      message: 'Failed to send welcome email',
      error: error.message
    };
  }
};

// Test email configuration
const testEmailConfig = async () => {
  if (process.env.EMAIL_USER && process.env.EMAIL_PASS) {
    try {
      const transporter = createEmailTransporter();
      await transporter.verify();
      console.log('✅ Email configuration is valid and ready to send emails');
      return true;
    } catch (error) {
      console.error('❌ Email configuration test failed:', error.message);
      console.log('💡 To fix this issue:');
      console.log('   1. Use a personal Gmail account with App Password');
      console.log('   2. Or set up OAuth2 authentication');
      console.log('   3. Or disable email functionality temporarily');
      console.log('🔄 System will continue without email functionality');
      return false;
    }
  } else {
    console.log('⚠️ Email configuration not found in environment variables');
    return false;
  }
};

// Send admin notification email for farmer requests
const sendAdminNotificationEmail = async (notificationData) => {
  try {
    console.log('🔔 Sending admin notification email for:', notificationData.type);

    // Check if email configuration is available
    if (!process.env.EMAIL_USER || !process.env.EMAIL_PASS) {
      console.log('⚠️ Email configuration not found, skipping admin notification email');
      return { success: false, message: 'Email configuration not available' };
    }

    const transporter = createEmailTransporter();

    // Verify connection
    await transporter.verify();
    console.log('✅ SMTP connection verified for admin notification email');

    // Get admin email (in production, this would come from database)
    const adminEmail = process.env.ADMIN_EMAIL || process.env.EMAIL_USER;

    // Create notification email content based on type
    let emailContent = '';
    let subject = '';

    switch (notificationData.type) {
      case 'tapper_request':
        subject = `🌱 New Tapper Request from ${notificationData.data.farmerName}`;
        emailContent = createTapperRequestEmailContent(notificationData);
        break;
      case 'land_lease':
        subject = `🏡 New Land Lease Application from ${notificationData.data.farmerName}`;
        emailContent = createLandLeaseEmailContent(notificationData);
        break;
      case 'service_request':
        const serviceType = notificationData.data.serviceType === 'fertilizer' ? 'Fertilizer' : 'Rain Guard';
        subject = `🔧 New ${serviceType} Service Request from ${notificationData.data.farmerName}`;
        emailContent = createServiceRequestEmailContent(notificationData);
        break;
      case 'leave_request':
        subject = `🏖️ New Leave Request from ${notificationData.data.staffName}`;
        emailContent = createLeaveRequestEmailContent(notificationData);
        break;
      case 'staff_application':
        subject = `👷 New Staff Application from ${notificationData.data.staffName}`;
        emailContent = createStaffApplicationEmailContent(notificationData);
        break;
      default:
        subject = `🔔 New Notification: ${notificationData.title}`;
        emailContent = createGenericNotificationEmailContent(notificationData);
    }

    // Send the email
    const result = await transporter.sendMail({
      from: `"RubberEco System" <${process.env.EMAIL_USER}>`,
      to: adminEmail,
      subject: subject,
      html: emailContent,
      text: convertHtmlToText(emailContent)
    });

    console.log(`✅ Admin notification email sent successfully to: ${adminEmail}`);
    console.log('Email message ID:', result.messageId);

    return {
      success: true,
      message: 'Admin notification email sent successfully',
      messageId: result.messageId
    };

  } catch (error) {
    console.error('❌ Failed to send admin notification email:', error);
    return {
      success: false,
      message: 'Failed to send admin notification email',
      error: error.message
    };
  }
};

// Create tapper request email content
const createTapperRequestEmailContent = (notificationData) => {
  const data = notificationData.data;
  return `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>New Tapper Request</title>
    </head>
    <body style="margin: 0; padding: 0; font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; background-color: #f5f7fa; line-height: 1.6;">
      <div style="max-width: 600px; margin: 20px auto; background-color: #ffffff; border-radius: 12px; box-shadow: 0 4px 20px rgba(0,0,0,0.1); overflow: hidden;">

        <!-- Header -->
        <div style="background: linear-gradient(135deg, #3b82f6 0%, #1d4ed8 100%); padding: 30px 20px; text-align: center; color: white;">
          <div style="font-size: 32px; margin-bottom: 10px;">🌱</div>
          <h1 style="margin: 0; font-size: 28px; font-weight: bold;">New Tapper Request</h1>
          <p style="margin: 5px 0 0 0; font-size: 16px; opacity: 0.9;">Immediate Action Required</p>
        </div>

        <!-- Alert Section -->
        <div style="background: linear-gradient(135deg, #f59e0b 0%, #d97706 100%); padding: 20px; text-align: center; color: white;">
          <h2 style="margin: 0; font-size: 20px;">⚡ ${data.urgency.toUpperCase()} PRIORITY REQUEST</h2>
          <p style="margin: 5px 0 0 0; font-size: 14px; opacity: 0.9;">Request ID: ${data.requestId}</p>
        </div>

        <!-- Content -->
        <div style="padding: 30px 20px;">
          <h2 style="color: #1f2937; margin: 0 0 20px 0; font-size: 24px;">
            Request from <span style="color: #3b82f6;">${data.farmerName}</span>
          </h2>

          <!-- Farmer Details -->
          <div style="background: #f8fafc; border: 2px solid #e2e8f0; border-radius: 10px; padding: 20px; margin: 20px 0;">
            <h3 style="color: #3b82f6; margin: 0 0 15px 0; font-size: 18px;">👤 Farmer Information</h3>
            <div style="display: grid; gap: 10px;">
              <div><strong>Name:</strong> ${data.farmerName}</div>
              <div><strong>Email:</strong> <a href="mailto:${data.farmerEmail}">${data.farmerEmail}</a></div>
              <div><strong>Phone:</strong> <a href="tel:${data.farmerPhone}">${data.farmerPhone}</a></div>
              <div><strong>Contact Preference:</strong> ${data.contactPreference}</div>
            </div>
          </div>

          <!-- Farm Details -->
          <div style="background: #f0fdf4; border: 2px solid #bbf7d0; border-radius: 10px; padding: 20px; margin: 20px 0;">
            <h3 style="color: #059669; margin: 0 0 15px 0; font-size: 18px;">🌾 Farm Details</h3>
            <div style="display: grid; gap: 10px;">
              <div><strong>Location:</strong> ${data.farmLocation}</div>
              <div><strong>Farm Size:</strong> ${data.farmSize}</div>
              <div><strong>Number of Trees:</strong> ${data.numberOfTrees}</div>
              <div><strong>Tapping Type:</strong> ${data.tappingType}</div>
            </div>
          </div>

          <!-- Service Details -->
          <div style="background: #fef3c7; border: 2px solid #fde047; border-radius: 10px; padding: 20px; margin: 20px 0;">
            <h3 style="color: #a16207; margin: 0 0 15px 0; font-size: 18px;">📋 Service Requirements</h3>
            <div style="display: grid; gap: 10px;">
              <div><strong>Start Date:</strong> ${data.startDate}</div>
              <div><strong>Duration:</strong> ${data.duration}</div>
              <div><strong>Preferred Time:</strong> ${data.preferredTime}</div>
              <div><strong>Budget Range:</strong> ${data.budgetRange || 'Not specified'}</div>
              ${data.specialRequirements ? `<div><strong>Special Requirements:</strong> ${data.specialRequirements}</div>` : ''}
            </div>
          </div>

          <!-- Action Buttons -->
          <div style="text-align: center; margin: 30px 0;">
            <a href="http://localhost:5175/admin/dashboard" style="display: inline-block; background: linear-gradient(135deg, #3b82f6 0%, #1d4ed8 100%); color: white; text-decoration: none; padding: 15px 30px; border-radius: 8px; font-weight: bold; font-size: 16px; margin: 0 10px; box-shadow: 0 4px 12px rgba(59, 130, 246, 0.3);">
              🚀 View in Dashboard
            </a>
            <a href="tel:${data.farmerPhone}" style="display: inline-block; background: linear-gradient(135deg, #059669 0%, #047857 100%); color: white; text-decoration: none; padding: 15px 30px; border-radius: 8px; font-weight: bold; font-size: 16px; margin: 0 10px; box-shadow: 0 4px 12px rgba(5, 150, 105, 0.3);">
              📞 Call Farmer
            </a>
          </div>

          <div style="background: #fef2f2; border-left: 4px solid #ef4444; padding: 15px; border-radius: 6px; margin-top: 20px;">
            <p style="margin: 0; color: #dc2626; font-size: 14px;">
              <strong>⏰ Action Required:</strong> This request requires immediate attention. Please assign a tapper or contact the farmer as soon as possible.
            </p>
          </div>
        </div>

        <!-- Footer -->
        <div style="background: #1f2937; color: #9ca3af; padding: 20px; text-align: center;">
          <p style="margin: 0; font-size: 12px;">© 2025 RubberEco. This is an automated notification.</p>
        </div>
      </div>
    </body>
    </html>
  `;
};

// Create land lease email content
const createLandLeaseEmailContent = (notificationData) => {
  const data = notificationData.data;
  return `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>New Land Lease Application</title>
    </head>
    <body style="margin: 0; padding: 0; font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; background-color: #f5f7fa; line-height: 1.6;">
      <div style="max-width: 600px; margin: 20px auto; background-color: #ffffff; border-radius: 12px; box-shadow: 0 4px 20px rgba(0,0,0,0.1); overflow: hidden;">

        <!-- Header -->
        <div style="background: linear-gradient(135deg, #059669 0%, #047857 100%); padding: 30px 20px; text-align: center; color: white;">
          <div style="font-size: 32px; margin-bottom: 10px;">🏡</div>
          <h1 style="margin: 0; font-size: 28px; font-weight: bold;">New Land Lease Application</h1>
          <p style="margin: 5px 0 0 0; font-size: 16px; opacity: 0.9;">Review Required</p>
        </div>

        <!-- Content -->
        <div style="padding: 30px 20px;">
          <h2 style="color: #1f2937; margin: 0 0 20px 0; font-size: 24px;">
            Application from <span style="color: #059669;">${data.farmerName}</span>
          </h2>

          <!-- Applicant Details -->
          <div style="background: #f0fdf4; border: 2px solid #bbf7d0; border-radius: 10px; padding: 20px; margin: 20px 0;">
            <h3 style="color: #059669; margin: 0 0 15px 0; font-size: 18px;">👤 Applicant Information</h3>
            <div style="display: grid; gap: 10px;">
              <div><strong>Name:</strong> ${data.farmerName}</div>
              <div><strong>Email:</strong> <a href="mailto:${data.farmerEmail}">${data.farmerEmail}</a></div>
              <div><strong>Phone:</strong> <a href="tel:${data.farmerPhone}">${data.farmerPhone}</a></div>
            </div>
          </div>

          <!-- Land Requirements -->
          <div style="background: #fef3c7; border: 2px solid #fde047; border-radius: 10px; padding: 20px; margin: 20px 0;">
            <h3 style="color: #a16207; margin: 0 0 15px 0; font-size: 18px;">🌾 Land Requirements</h3>
            <div style="display: grid; gap: 10px;">
              <div><strong>Desired Location:</strong> ${data.desiredLocation}</div>
              <div><strong>Land Size:</strong> ${data.landSize}</div>
              <div><strong>Lease Duration:</strong> ${data.leaseDuration}</div>
              <div><strong>Proposed Rent:</strong> ${data.proposedRent}</div>
              <div><strong>Intended Use:</strong> ${data.intendedUse}</div>
            </div>
          </div>

          <!-- Action Buttons -->
          <div style="text-align: center; margin: 30px 0;">
            <a href="http://localhost:5175/admin/dashboard" style="display: inline-block; background: linear-gradient(135deg, #059669 0%, #047857 100%); color: white; text-decoration: none; padding: 15px 30px; border-radius: 8px; font-weight: bold; font-size: 16px; margin: 0 10px; box-shadow: 0 4px 12px rgba(5, 150, 105, 0.3);">
              🚀 Review Application
            </a>
            <a href="tel:${data.farmerPhone}" style="display: inline-block; background: linear-gradient(135deg, #3b82f6 0%, #1d4ed8 100%); color: white; text-decoration: none; padding: 15px 30px; border-radius: 8px; font-weight: bold; font-size: 16px; margin: 0 10px; box-shadow: 0 4px 12px rgba(59, 130, 246, 0.3);">
              📞 Contact Applicant
            </a>
          </div>
        </div>

        <!-- Footer -->
        <div style="background: #1f2937; color: #9ca3af; padding: 20px; text-align: center;">
          <p style="margin: 0; font-size: 12px;">© 2025 RubberEco. This is an automated notification.</p>
        </div>
      </div>
    </body>
    </html>
  `;
};

// Create service request email content
const createServiceRequestEmailContent = (notificationData) => {
  const data = notificationData.data;
  const serviceType = data.serviceType === 'fertilizer' ? 'Fertilizer Application' : 'Rain Guard Installation';

  return `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>New Service Request</title>
    </head>
    <body style="margin: 0; padding: 0; font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; background-color: #f5f7fa; line-height: 1.6;">
      <div style="max-width: 600px; margin: 20px auto; background-color: #ffffff; border-radius: 12px; box-shadow: 0 4px 20px rgba(0,0,0,0.1); overflow: hidden;">

        <!-- Header -->
        <div style="background: linear-gradient(135deg, #f97316 0%, #ea580c 100%); padding: 30px 20px; text-align: center; color: white;">
          <div style="font-size: 32px; margin-bottom: 10px;">🔧</div>
          <h1 style="margin: 0; font-size: 28px; font-weight: bold;">New ${serviceType} Request</h1>
          <p style="margin: 5px 0 0 0; font-size: 16px; opacity: 0.9;">Service Assignment Required</p>
        </div>

        <!-- Content -->
        <div style="padding: 30px 20px;">
          <h2 style="color: #1f2937; margin: 0 0 20px 0; font-size: 24px;">
            Request from <span style="color: #f97316;">${data.farmerName}</span>
          </h2>

          <!-- Farmer Details -->
          <div style="background: #fff7ed; border: 2px solid #fed7aa; border-radius: 10px; padding: 20px; margin: 20px 0;">
            <h3 style="color: #ea580c; margin: 0 0 15px 0; font-size: 18px;">👤 Farmer Information</h3>
            <div style="display: grid; gap: 10px;">
              <div><strong>Name:</strong> ${data.farmerName}</div>
              <div><strong>Email:</strong> <a href="mailto:${data.farmerEmail}">${data.farmerEmail}</a></div>
              <div><strong>Phone:</strong> <a href="tel:${data.farmerPhone}">${data.farmerPhone}</a></div>
            </div>
          </div>

          <!-- Service Details -->
          <div style="background: #f0fdf4; border: 2px solid #bbf7d0; border-radius: 10px; padding: 20px; margin: 20px 0;">
            <h3 style="color: #059669; margin: 0 0 15px 0; font-size: 18px;">🌾 Service Requirements</h3>
            <div style="display: grid; gap: 10px;">
              <div><strong>Service Type:</strong> ${serviceType}</div>
              <div><strong>Farm Location:</strong> ${data.farmLocation}</div>
              <div><strong>Farm Size:</strong> ${data.farmSize}</div>
              <div><strong>Number of Trees:</strong> ${data.numberOfTrees}</div>
              <div><strong>Preferred Date:</strong> ${data.preferredDate}</div>
              <div><strong>Urgency:</strong> ${data.urgency.toUpperCase()}</div>
              <div><strong>Budget Range:</strong> ${data.budgetRange || 'Not specified'}</div>
            </div>
          </div>

          <!-- Action Buttons -->
          <div style="text-align: center; margin: 30px 0;">
            <a href="http://localhost:5175/admin/dashboard" style="display: inline-block; background: linear-gradient(135deg, #f97316 0%, #ea580c 100%); color: white; text-decoration: none; padding: 15px 30px; border-radius: 8px; font-weight: bold; font-size: 16px; margin: 0 10px; box-shadow: 0 4px 12px rgba(249, 115, 22, 0.3);">
              🚀 Assign Provider
            </a>
            <a href="tel:${data.farmerPhone}" style="display: inline-block; background: linear-gradient(135deg, #3b82f6 0%, #1d4ed8 100%); color: white; text-decoration: none; padding: 15px 30px; border-radius: 8px; font-weight: bold; font-size: 16px; margin: 0 10px; box-shadow: 0 4px 12px rgba(59, 130, 246, 0.3);">
              📞 Contact Farmer
            </a>
          </div>
        </div>

        <!-- Footer -->
        <div style="background: #1f2937; color: #9ca3af; padding: 20px; text-align: center;">
          <p style="margin: 0; font-size: 12px;">© 2025 RubberEco. This is an automated notification.</p>
        </div>
      </div>
    </body>
    </html>
  `;
};

// Create leave request email content
const createLeaveRequestEmailContent = (notificationData) => {
  const data = notificationData.data;
  const urgencyColor = data.urgency === 'emergency' ? '#dc2626' :
                      data.urgency === 'high' ? '#f59e0b' : '#3b82f6';

  return `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>New Leave Request</title>
    </head>
    <body style="margin: 0; padding: 0; font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; background-color: #f5f7fa; line-height: 1.6;">
      <div style="max-width: 600px; margin: 20px auto; background-color: #ffffff; border-radius: 12px; box-shadow: 0 4px 20px rgba(0,0,0,0.1); overflow: hidden;">

        <!-- Header -->
        <div style="background: linear-gradient(135deg, #8b5cf6 0%, #7c3aed 100%); padding: 30px 20px; text-align: center; color: white;">
          <div style="font-size: 32px; margin-bottom: 10px;">🏖️</div>
          <h1 style="margin: 0; font-size: 28px; font-weight: bold;">New Leave Request</h1>
          <p style="margin: 5px 0 0 0; font-size: 16px; opacity: 0.9;">Requires Admin Review</p>
        </div>

        <!-- Urgency Alert -->
        <div style="background: ${urgencyColor}; padding: 15px; text-align: center; color: white;">
          <h2 style="margin: 0; font-size: 18px;">⚡ ${data.urgency.toUpperCase()} PRIORITY</h2>
          <p style="margin: 5px 0 0 0; font-size: 14px; opacity: 0.9;">Request ID: ${data.requestId}</p>
        </div>

        <!-- Content -->
        <div style="padding: 30px 20px;">
          <h2 style="color: #1f2937; margin: 0 0 20px 0; font-size: 24px;">
            Leave Request from <span style="color: #8b5cf6;">${data.staffName}</span>
          </h2>

          <!-- Staff Details -->
          <div style="background: #f8fafc; border: 2px solid #e2e8f0; border-radius: 10px; padding: 20px; margin: 20px 0;">
            <h3 style="color: #8b5cf6; margin: 0 0 15px 0; font-size: 18px;">👤 Staff Information</h3>
            <div style="display: grid; gap: 10px;">
              <div><strong>Name:</strong> ${data.staffName}</div>
              <div><strong>Email:</strong> <a href="mailto:${data.staffEmail}">${data.staffEmail}</a></div>
              <div><strong>Role:</strong> ${data.staffRole.charAt(0).toUpperCase() + data.staffRole.slice(1).replace('_', ' ')}</div>
              <div><strong>Department:</strong> ${data.staffDepartment}</div>
            </div>
          </div>

          <!-- Leave Details -->
          <div style="background: #fef3c7; border: 2px solid #fde047; border-radius: 10px; padding: 20px; margin: 20px 0;">
            <h3 style="color: #a16207; margin: 0 0 15px 0; font-size: 18px;">📅 Leave Details</h3>
            <div style="display: grid; gap: 10px;">
              <div><strong>Leave Type:</strong> ${data.leaveType.charAt(0).toUpperCase() + data.leaveType.slice(1)} Leave</div>
              <div><strong>Start Date:</strong> ${data.startDate}</div>
              <div><strong>End Date:</strong> ${data.endDate}</div>
              <div><strong>Total Days:</strong> ${data.totalDays} day(s)</div>
              <div><strong>Urgency:</strong> ${data.urgency.toUpperCase()}</div>
              <div><strong>Reason:</strong> ${data.reason}</div>
            </div>
          </div>

          ${data.contactDuringLeave && (data.contactDuringLeave.phone || data.contactDuringLeave.alternateContact) ? `
          <!-- Contact During Leave -->
          <div style="background: #f0fdf4; border: 2px solid #bbf7d0; border-radius: 10px; padding: 20px; margin: 20px 0;">
            <h3 style="color: #059669; margin: 0 0 15px 0; font-size: 18px;">📞 Contact During Leave</h3>
            <div style="display: grid; gap: 10px;">
              ${data.contactDuringLeave.phone ? `<div><strong>Phone:</strong> ${data.contactDuringLeave.phone}</div>` : ''}
              ${data.contactDuringLeave.alternateContact ? `<div><strong>Alternate Contact:</strong> ${data.contactDuringLeave.alternateContact}</div>` : ''}
            </div>
          </div>
          ` : ''}

          <!-- Action Buttons -->
          <div style="text-align: center; margin: 30px 0;">
            <a href="http://localhost:5175/admin/staff-management" style="display: inline-block; background: linear-gradient(135deg, #22c55e 0%, #16a34a 100%); color: white; text-decoration: none; padding: 15px 30px; border-radius: 8px; font-weight: bold; font-size: 16px; margin: 0 10px; box-shadow: 0 4px 12px rgba(34, 197, 94, 0.3);">
              ✅ Approve Leave
            </a>
            <a href="http://localhost:5175/admin/staff-management" style="display: inline-block; background: linear-gradient(135deg, #ef4444 0%, #dc2626 100%); color: white; text-decoration: none; padding: 15px 30px; border-radius: 8px; font-weight: bold; font-size: 16px; margin: 0 10px; box-shadow: 0 4px 12px rgba(239, 68, 68, 0.3);">
              ❌ Reject Leave
            </a>
          </div>

          <div style="background: #fef2f2; border-left: 4px solid #ef4444; padding: 15px; border-radius: 6px; margin-top: 20px;">
            <p style="margin: 0; color: #dc2626; font-size: 14px;">
              <strong>⏰ Action Required:</strong> This leave request requires immediate review. Please approve or reject as soon as possible.
            </p>
          </div>
        </div>

        <!-- Footer -->
        <div style="background: #1f2937; color: #9ca3af; padding: 20px; text-align: center;">
          <p style="margin: 0; font-size: 12px;">© 2025 RubberEco. This is an automated notification.</p>
        </div>
      </div>
    </body>
    </html>
  `;
};

// Create generic notification email content
const createGenericNotificationEmailContent = (notificationData) => {
  return `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>${notificationData.title}</title>
    </head>
    <body style="margin: 0; padding: 0; font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; background-color: #f5f7fa; line-height: 1.6;">
      <div style="max-width: 600px; margin: 20px auto; background-color: #ffffff; border-radius: 12px; box-shadow: 0 4px 20px rgba(0,0,0,0.1); overflow: hidden;">

        <!-- Header -->
        <div style="background: linear-gradient(135deg, #6366f1 0%, #4f46e5 100%); padding: 30px 20px; text-align: center; color: white;">
          <div style="font-size: 32px; margin-bottom: 10px;">🔔</div>
          <h1 style="margin: 0; font-size: 28px; font-weight: bold;">${notificationData.title}</h1>
          <p style="margin: 5px 0 0 0; font-size: 16px; opacity: 0.9;">New Notification</p>
        </div>

        <!-- Content -->
        <div style="padding: 30px 20px;">
          <p style="color: #374151; font-size: 16px; margin-bottom: 20px;">${notificationData.message}</p>

          <!-- Action Button -->
          <div style="text-align: center; margin: 30px 0;">
            <a href="http://localhost:5175/admin/dashboard" style="display: inline-block; background: linear-gradient(135deg, #6366f1 0%, #4f46e5 100%); color: white; text-decoration: none; padding: 15px 30px; border-radius: 8px; font-weight: bold; font-size: 16px; box-shadow: 0 4px 12px rgba(99, 102, 241, 0.3);">
              🚀 View Dashboard
            </a>
          </div>
        </div>

        <!-- Footer -->
        <div style="background: #1f2937; color: #9ca3af; padding: 20px; text-align: center;">
          <p style="margin: 0; font-size: 12px;">© 2025 RubberEco. This is an automated notification.</p>
        </div>
      </div>
    </body>
    </html>
  `;
};

// Convert HTML to plain text (basic implementation)
const convertHtmlToText = (html) => {
  return html
    .replace(/<[^>]*>/g, '')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/\s+/g, ' ')
    .trim();
};

// Send leave approval notification to staff
const sendLeaveApprovalEmail = async (staffData, leaveData, adminData) => {
  try {
    console.log(`📧 Sending leave approval email to: ${staffData.email}`);

    const transporter = createEmailTransporter();

    const approvalMessage = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; background-color: #f9f9f9;">
        <div style="background-color: #ffffff; padding: 30px; border-radius: 10px; box-shadow: 0 2px 10px rgba(0,0,0,0.1);">

          <!-- Header -->
          <div style="text-align: center; margin-bottom: 30px;">
            <h1 style="color: #22c55e; margin: 0; font-size: 28px;">✅ Leave Request Approved</h1>
            <p style="color: #666; margin: 10px 0 0 0; font-size: 16px;">Your leave request has been approved</p>
          </div>

          <!-- Greeting -->
          <div style="margin-bottom: 25px;">
            <p style="color: #333; font-size: 16px; margin: 0;">Dear ${staffData.name},</p>
          </div>

          <!-- Approval Message -->
          <div style="background-color: #f0fdf4; padding: 20px; border-radius: 8px; border-left: 4px solid #22c55e; margin-bottom: 25px;">
            <p style="color: #15803d; margin: 0; font-size: 16px; font-weight: 600;">
              🎉 Great news! Your leave request has been approved.
            </p>
          </div>

          <!-- Leave Details -->
          <div style="background-color: #f8fafc; padding: 20px; border-radius: 8px; margin-bottom: 25px;">
            <h3 style="color: #1e293b; margin: 0 0 15px 0; font-size: 18px;">📋 Leave Details</h3>
            <table style="width: 100%; border-collapse: collapse;">
              <tr>
                <td style="padding: 8px 0; color: #64748b; font-weight: 600; width: 40%;">Request ID:</td>
                <td style="padding: 8px 0; color: #1e293b;">${leaveData.requestId}</td>
              </tr>
              <tr>
                <td style="padding: 8px 0; color: #64748b; font-weight: 600;">Leave Type:</td>
                <td style="padding: 8px 0; color: #1e293b;">${leaveData.leaveType.charAt(0).toUpperCase() + leaveData.leaveType.slice(1)} Leave</td>
              </tr>
              <tr>
                <td style="padding: 8px 0; color: #64748b; font-weight: 600;">Start Date:</td>
                <td style="padding: 8px 0; color: #1e293b;">${leaveData.formattedStartDate}</td>
              </tr>
              <tr>
                <td style="padding: 8px 0; color: #64748b; font-weight: 600;">End Date:</td>
                <td style="padding: 8px 0; color: #1e293b;">${leaveData.formattedEndDate}</td>
              </tr>
              <tr>
                <td style="padding: 8px 0; color: #64748b; font-weight: 600;">Total Days:</td>
                <td style="padding: 8px 0; color: #1e293b;">${leaveData.totalDays} day(s)</td>
              </tr>
              <tr>
                <td style="padding: 8px 0; color: #64748b; font-weight: 600;">Approved By:</td>
                <td style="padding: 8px 0; color: #1e293b;">${adminData.name}</td>
              </tr>
            </table>
          </div>

          ${leaveData.adminResponse?.comments ? `
          <!-- Admin Comments -->
          <div style="background-color: #eff6ff; padding: 20px; border-radius: 8px; border-left: 4px solid #3b82f6; margin-bottom: 25px;">
            <h4 style="color: #1e40af; margin: 0 0 10px 0; font-size: 16px;">💬 Admin Comments</h4>
            <p style="color: #1e40af; margin: 0; font-style: italic;">"${leaveData.adminResponse.comments}"</p>
          </div>
          ` : ''}

          <!-- Important Notes -->
          <div style="background-color: #fef3c7; padding: 20px; border-radius: 8px; border-left: 4px solid #f59e0b; margin-bottom: 25px;">
            <h4 style="color: #92400e; margin: 0 0 10px 0; font-size: 16px;">📌 Important Notes</h4>
            <ul style="color: #92400e; margin: 0; padding-left: 20px;">
              <li>Please ensure all pending work is properly handed over before your leave starts</li>
              <li>Keep your contact information updated during the leave period</li>
              <li>Report back to work on the scheduled return date</li>
              <li>Contact your supervisor if you need to extend your leave</li>
            </ul>
          </div>

          <!-- Contact Information -->
          <div style="text-align: center; margin-top: 30px; padding-top: 20px; border-top: 1px solid #e2e8f0;">
            <p style="color: #64748b; margin: 0; font-size: 14px;">
              If you have any questions, please contact your supervisor or HR department.
            </p>
            <p style="color: #64748b; margin: 10px 0 0 0; font-size: 14px;">
              📧 Email: admin@rubbereco.com | 📞 Phone: +91 98765 43210
            </p>
          </div>

          <!-- Footer -->
          <div style="text-align: center; margin-top: 30px; padding-top: 20px; border-top: 1px solid #e2e8f0;">
            <p style="color: #94a3b8; margin: 0; font-size: 12px;">
              This is an automated message from RubberEco. Please do not reply to this email.
            </p>
            <p style="color: #94a3b8; margin: 5px 0 0 0; font-size: 12px;">
              © 2024 RubberEco. All rights reserved.
            </p>
          </div>

        </div>
      </div>
    `;

    const result = await transporter.sendMail({
      from: `"RubberEco Team" <${process.env.EMAIL_USER}>`,
      to: staffData.email,
      subject: `✅ Leave Approved: ${leaveData.requestId} | RubberEco`,
      html: approvalMessage
    });

    console.log(`✅ Leave approval email sent successfully to: ${staffData.email}`);
    return {
      success: true,
      message: 'Leave approval email sent successfully',
      messageId: result.messageId
    };

  } catch (error) {
    console.error('❌ Failed to send leave approval email:', error);
    return {
      success: false,
      message: 'Failed to send leave approval email',
      error: error.message
    };
  }
};

// Send leave rejection notification to staff
const sendLeaveRejectionEmail = async (staffData, leaveData, adminData) => {
  try {
    console.log(`📧 Sending leave rejection email to: ${staffData.email}`);

    const transporter = createEmailTransporter();

    const rejectionMessage = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; background-color: #f9f9f9;">
        <div style="background-color: #ffffff; padding: 30px; border-radius: 10px; box-shadow: 0 2px 10px rgba(0,0,0,0.1);">

          <!-- Header -->
          <div style="text-align: center; margin-bottom: 30px;">
            <h1 style="color: #ef4444; margin: 0; font-size: 28px;">❌ Leave Request Not Approved</h1>
            <p style="color: #666; margin: 10px 0 0 0; font-size: 16px;">Your leave request requires revision</p>
          </div>

          <!-- Greeting -->
          <div style="margin-bottom: 25px;">
            <p style="color: #333; font-size: 16px; margin: 0;">Dear ${staffData.name},</p>
          </div>

          <!-- Rejection Message -->
          <div style="background-color: #fef2f2; padding: 20px; border-radius: 8px; border-left: 4px solid #ef4444; margin-bottom: 25px;">
            <p style="color: #dc2626; margin: 0; font-size: 16px; font-weight: 600;">
              We regret to inform you that your leave request could not be approved at this time.
            </p>
          </div>

          <!-- Leave Details -->
          <div style="background-color: #f8fafc; padding: 20px; border-radius: 8px; margin-bottom: 25px;">
            <h3 style="color: #1e293b; margin: 0 0 15px 0; font-size: 18px;">📋 Leave Request Details</h3>
            <table style="width: 100%; border-collapse: collapse;">
              <tr>
                <td style="padding: 8px 0; color: #64748b; font-weight: 600; width: 40%;">Request ID:</td>
                <td style="padding: 8px 0; color: #1e293b;">${leaveData.requestId}</td>
              </tr>
              <tr>
                <td style="padding: 8px 0; color: #64748b; font-weight: 600;">Leave Type:</td>
                <td style="padding: 8px 0; color: #1e293b;">${leaveData.leaveType.charAt(0).toUpperCase() + leaveData.leaveType.slice(1)} Leave</td>
              </tr>
              <tr>
                <td style="padding: 8px 0; color: #64748b; font-weight: 600;">Requested Dates:</td>
                <td style="padding: 8px 0; color: #1e293b;">${leaveData.formattedStartDate} to ${leaveData.formattedEndDate}</td>
              </tr>
              <tr>
                <td style="padding: 8px 0; color: #64748b; font-weight: 600;">Total Days:</td>
                <td style="padding: 8px 0; color: #1e293b;">${leaveData.totalDays} day(s)</td>
              </tr>
              <tr>
                <td style="padding: 8px 0; color: #64748b; font-weight: 600;">Reviewed By:</td>
                <td style="padding: 8px 0; color: #1e293b;">${adminData.name}</td>
              </tr>
            </table>
          </div>

          ${leaveData.adminResponse?.comments ? `
          <!-- Admin Comments -->
          <div style="background-color: #fef3c7; padding: 20px; border-radius: 8px; border-left: 4px solid #f59e0b; margin-bottom: 25px;">
            <h4 style="color: #92400e; margin: 0 0 10px 0; font-size: 16px;">💬 Reason for Rejection</h4>
            <p style="color: #92400e; margin: 0; font-style: italic;">"${leaveData.adminResponse.comments}"</p>
          </div>
          ` : ''}

          <!-- Next Steps -->
          <div style="background-color: #eff6ff; padding: 20px; border-radius: 8px; border-left: 4px solid #3b82f6; margin-bottom: 25px;">
            <h4 style="color: #1e40af; margin: 0 0 10px 0; font-size: 16px;">📌 Next Steps</h4>
            <ul style="color: #1e40af; margin: 0; padding-left: 20px;">
              <li>Review the feedback provided above</li>
              <li>Consider adjusting your leave dates if possible</li>
              <li>Contact your supervisor to discuss alternative arrangements</li>
              <li>You may submit a new leave request with revised details</li>
            </ul>
          </div>

          <!-- Contact Information -->
          <div style="text-align: center; margin-top: 30px; padding-top: 20px; border-top: 1px solid #e2e8f0;">
            <p style="color: #64748b; margin: 0; font-size: 14px;">
              If you have any questions or need clarification, please contact your supervisor or HR department.
            </p>
            <p style="color: #64748b; margin: 10px 0 0 0; font-size: 14px;">
              📧 Email: admin@rubbereco.com | 📞 Phone: +91 98765 43210
            </p>
          </div>

          <!-- Footer -->
          <div style="text-align: center; margin-top: 30px; padding-top: 20px; border-top: 1px solid #e2e8f0;">
            <p style="color: #94a3b8; margin: 0; font-size: 12px;">
              This is an automated message from RubberEco. Please do not reply to this email.
            </p>
            <p style="color: #94a3b8; margin: 5px 0 0 0; font-size: 12px;">
              © 2024 RubberEco. All rights reserved.
            </p>
          </div>

        </div>
      </div>
    `;

    const result = await transporter.sendMail({
      from: `"RubberEco Team" <${process.env.EMAIL_USER}>`,
      to: staffData.email,
      subject: `❌ Leave Request Update: ${leaveData.requestId} | RubberEco`,
      html: rejectionMessage
    });

    console.log(`✅ Leave rejection email sent successfully to: ${staffData.email}`);
    return {
      success: true,
      message: 'Leave rejection email sent successfully',
      messageId: result.messageId
    };

  } catch (error) {
    console.error('❌ Failed to send leave rejection email:', error);
    return {
      success: false,
      message: 'Failed to send leave rejection email',
      error: error.message
    };
  }
};

// Send farmer notification when assigned staff takes leave
const sendFarmerStaffLeaveNotification = async (farmerData, staffData, leaveData) => {
  try {
    console.log(`📧 Sending staff leave notification to farmer: ${farmerData.farmerEmail}`);

    const transporter = createEmailTransporter();

    const notificationMessage = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; background-color: #f9f9f9;">
        <div style="background-color: #ffffff; padding: 30px; border-radius: 10px; box-shadow: 0 2px 10px rgba(0,0,0,0.1);">

          <!-- Header -->
          <div style="text-align: center; margin-bottom: 30px;">
            <h1 style="color: #f59e0b; margin: 0; font-size: 28px;">⚠️ Staff Leave Notification</h1>
            <p style="color: #666; margin: 10px 0 0 0; font-size: 16px;">Your assigned staff member will be on leave</p>
          </div>

          <!-- Greeting -->
          <div style="margin-bottom: 25px;">
            <p style="color: #333; font-size: 16px; margin: 0;">Dear ${farmerData.farmerName},</p>
          </div>

          <!-- Notification Message -->
          <div style="background-color: #fef3c7; padding: 20px; border-radius: 8px; border-left: 4px solid #f59e0b; margin-bottom: 25px;">
            <p style="color: #92400e; margin: 0; font-size: 16px; font-weight: 600;">
              We want to inform you that ${staffData.name}, who is assigned to your farm, will be on leave during the dates mentioned below.
            </p>
          </div>

          <!-- Staff Details -->
          <div style="background-color: #f0f9ff; padding: 20px; border-radius: 8px; margin-bottom: 25px;">
            <h3 style="color: #1e40af; margin: 0 0 15px 0; font-size: 18px;">👤 Staff Information</h3>
            <table style="width: 100%; border-collapse: collapse;">
              <tr>
                <td style="padding: 8px 0; color: #64748b; font-weight: 600; width: 40%;">Staff Name:</td>
                <td style="padding: 8px 0; color: #1e293b;">${staffData.name}</td>
              </tr>
              <tr>
                <td style="padding: 8px 0; color: #64748b; font-weight: 600;">Role:</td>
                <td style="padding: 8px 0; color: #1e293b;">${staffData.role.charAt(0).toUpperCase() + staffData.role.slice(1).replace('_', ' ')}</td>
              </tr>
              <tr>
                <td style="padding: 8px 0; color: #64748b; font-weight: 600;">Assignment Type:</td>
                <td style="padding: 8px 0; color: #1e293b;">${farmerData.assignmentType || 'General Services'}</td>
              </tr>
            </table>
          </div>

          <!-- Leave Details -->
          <div style="background-color: #fef2f2; padding: 20px; border-radius: 8px; margin-bottom: 25px;">
            <h3 style="color: #dc2626; margin: 0 0 15px 0; font-size: 18px;">📅 Leave Details</h3>
            <table style="width: 100%; border-collapse: collapse;">
              <tr>
                <td style="padding: 8px 0; color: #64748b; font-weight: 600; width: 40%;">Leave Type:</td>
                <td style="padding: 8px 0; color: #1e293b;">${leaveData.leaveType.charAt(0).toUpperCase() + leaveData.leaveType.slice(1)} Leave</td>
              </tr>
              <tr>
                <td style="padding: 8px 0; color: #64748b; font-weight: 600;">Start Date:</td>
                <td style="padding: 8px 0; color: #1e293b;">${leaveData.formattedStartDate}</td>
              </tr>
              <tr>
                <td style="padding: 8px 0; color: #64748b; font-weight: 600;">End Date:</td>
                <td style="padding: 8px 0; color: #1e293b;">${leaveData.formattedEndDate}</td>
              </tr>
              <tr>
                <td style="padding: 8px 0; color: #64748b; font-weight: 600;">Total Days:</td>
                <td style="padding: 8px 0; color: #1e293b;">${leaveData.totalDays} day(s)</td>
              </tr>
            </table>
          </div>

          <!-- Alternative Arrangements -->
          <div style="background-color: #f0fdf4; padding: 20px; border-radius: 8px; border-left: 4px solid #22c55e; margin-bottom: 25px;">
            <h4 style="color: #15803d; margin: 0 0 10px 0; font-size: 16px;">🔄 Alternative Arrangements</h4>
            <p style="color: #15803d; margin: 0;">
              We will ensure that alternative arrangements are made to minimize any disruption to your farm operations.
              If you have any urgent requirements during this period, please contact our office immediately.
            </p>
          </div>

          <!-- Contact Information -->
          <div style="text-align: center; margin-top: 30px; padding-top: 20px; border-top: 1px solid #e2e8f0;">
            <p style="color: #64748b; margin: 0; font-size: 14px;">
              For any urgent assistance or to arrange alternative support, please contact us:
            </p>
            <p style="color: #64748b; margin: 10px 0 0 0; font-size: 14px;">
              📧 Email: admin@rubbereco.com | 📞 Phone: +91 98765 43210
            </p>
          </div>

          <!-- Footer -->
          <div style="text-align: center; margin-top: 30px; padding-top: 20px; border-top: 1px solid #e2e8f0;">
            <p style="color: #94a3b8; margin: 0; font-size: 12px;">
              This is an automated message from RubberEco. Please do not reply to this email.
            </p>
            <p style="color: #94a3b8; margin: 5px 0 0 0; font-size: 12px;">
              © 2024 RubberEco. All rights reserved.
            </p>
          </div>

        </div>
      </div>
    `;

    const result = await transporter.sendMail({
      from: `"RubberEco Team" <${process.env.EMAIL_USER}>`,
      to: farmerData.farmerEmail,
      subject: `⚠️ Staff Leave Notice: ${staffData.name} | RubberEco`,
      html: notificationMessage
    });

    console.log(`✅ Farmer notification email sent successfully to: ${farmerData.farmerEmail}`);
    return {
      success: true,
      message: 'Farmer notification email sent successfully',
      messageId: result.messageId
    };

  } catch (error) {
    console.error('❌ Failed to send farmer notification email:', error);
    return {
      success: false,
      message: 'Failed to send farmer notification email',
      error: error.message
    };
  }
};

// Send service request email notifications
const sendServiceRequestEmail = async (emailData) => {
  try {
    const transporter = createEmailTransporter();

    const { type, farmerEmail } = emailData;

    const subjectMap = {
      submitted: 'Service Request Submitted - RubberEco',
      approved: 'Service Request Approved - RubberEco',
      rejected: 'Service Request Update - RubberEco',
      assigned: 'Service Provider Assigned - RubberEco'
    };

    const mailOptions = {
      from: `"RubberEco" <${process.env.EMAIL_USER}>`,
      to: farmerEmail,
      subject: subjectMap[type] || 'Service Request Update - RubberEco',
      html: getServiceRequestEmailTemplate(type, emailData)
    };

    const result = await transporter.sendMail(mailOptions);
    console.log(`Email sent successfully to ${farmerEmail}:`, result.messageId);
    return result;

  } catch (error) {
    console.error('Error sending service request email:', error);
    throw error;
  }
};

// Service request email templates
const getServiceRequestEmailTemplate = (type, data) => {
  const baseStyle = `
    <style>
      body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
      .container { max-width: 600px; margin: 0 auto; padding: 20px; }
      .header { background: linear-gradient(135deg, #ef4444, #dc2626); color: white; padding: 20px; border-radius: 8px 8px 0 0; }
      .content { background: #f9fafb; padding: 30px; border-radius: 0 0 8px 8px; }
      .button { display: inline-block; background: #ef4444; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; margin: 20px 0; }
      .info-box { background: white; padding: 20px; border-radius: 6px; margin: 20px 0; border-left: 4px solid #ef4444; }
      .footer { text-align: center; margin-top: 30px; color: #666; font-size: 14px; }
    </style>
  `;

  switch (type) {
    case 'submitted':
      return `
        <!DOCTYPE html>
        <html>
        <head>${baseStyle}</head>
        <body>
          <div class="container">
            <div class="header">
              <h1>🌱 Service Request Submitted</h1>
            </div>
            <div class="content">
              <h2>Hello ${data.farmerName},</h2>
              <p>Thank you for submitting your service request. We have received your application and it is now under review.</p>

              <div class="info-box">
                <h3>Request Details:</h3>
                <p><strong>Request ID:</strong> ${data.requestId}</p>
                <p><strong>Service Type:</strong> ${data.serviceType}</p>
                <p><strong>Submitted Date:</strong> ${new Date(data.submittedDate).toLocaleDateString()}</p>
                <p><strong>Status:</strong> Submitted</p>
              </div>

              <p>Our field workers will review your request and get back to you within 24-48 hours. You will receive an email notification once your request is approved.</p>

              <div class="footer">
                <p>Best regards,<br>RubberEco Team</p>
                <p>For any questions, please contact us at support@rubbereco.com</p>
              </div>
            </div>
          </div>
        </body>
        </html>
      `;

    case 'approved':
      return `
        <!DOCTYPE html>
        <html>
        <head>${baseStyle}</head>
        <body>
          <div class="container">
            <div class="header">
              <h1>✅ Service Request Approved</h1>
            </div>
            <div class="content">
              <h2>Great news, ${data.farmerName}!</h2>
              <p>Your service request has been approved by our field worker team.</p>

              <div class="info-box">
                <h3>Request Details:</h3>
                <p><strong>Request ID:</strong> ${data.requestId}</p>
                <p><strong>Service Type:</strong> ${data.serviceType}</p>
                <p><strong>Approved Date:</strong> ${new Date(data.reviewDate).toLocaleDateString()}</p>
                <p><strong>Reviewed By:</strong> ${data.reviewerName}</p>
                ${data.estimatedCost ? `<p><strong>Estimated Cost:</strong> ₹${data.estimatedCost}</p>` : ''}
                ${data.reviewNotes ? `<p><strong>Notes:</strong> ${data.reviewNotes}</p>` : ''}
              </div>

              <p>We will now assign a qualified service provider to handle your request. You will receive another notification once a provider is assigned with their contact details.</p>

              <div class="footer">
                <p>Best regards,<br>RubberEco Team</p>
                <p>For any questions, please contact us at support@rubbereco.com</p>
              </div>
            </div>
          </div>
        </body>
        </html>
      `;

    case 'rejected':
      return `
        <!DOCTYPE html>
        <html>
        <head>${baseStyle}</head>
        <body>
          <div class="container">
            <div class="header">
              <h1>❌ Service Request Update</h1>
            </div>
            <div class="content">
              <h2>Hello ${data.farmerName},</h2>
              <p>We regret to inform you that your service request could not be approved at this time.</p>

              <div class="info-box">
                <h3>Request Details:</h3>
                <p><strong>Request ID:</strong> ${data.requestId}</p>
                <p><strong>Service Type:</strong> ${data.serviceType}</p>
                <p><strong>Review Date:</strong> ${new Date(data.reviewDate).toLocaleDateString()}</p>
                <p><strong>Reviewed By:</strong> ${data.reviewerName}</p>
                ${data.reviewNotes ? `<p><strong>Reason:</strong> ${data.reviewNotes}</p>` : ''}
              </div>

              <p>You can submit a new request with updated information or contact our support team for assistance.</p>

              <div class="footer">
                <p>Best regards,<br>RubberEco Team</p>
                <p>For any questions, please contact us at support@rubbereco.com</p>
              </div>
            </div>
          </div>
        </body>
        </html>
      `;

    case 'assigned':
      return `
        <!DOCTYPE html>
        <html>
        <head>${baseStyle}</head>
        <body>
          <div class="container">
            <div class="header">
              <h1>👨‍🌾 Service Provider Assigned</h1>
            </div>
            <div class="content">
              <h2>Hello ${data.farmerName},</h2>
              <p>Excellent news! We have assigned a qualified service provider to handle your request.</p>

              <div class="info-box">
                <h3>Request Details:</h3>
                <p><strong>Request ID:</strong> ${data.requestId}</p>
                <p><strong>Service Type:</strong> ${data.serviceType}</p>
                <p><strong>Assignment Date:</strong> ${new Date(data.assignedDate).toLocaleDateString()}</p>
              </div>

              <div class="info-box">
                <h3>Service Provider Details:</h3>
                <p><strong>Provider:</strong> ${data.providerName}</p>
                <p><strong>Contact:</strong> ${data.providerContact}</p>
              </div>

              <p>The service provider will contact you directly to schedule the service. Please ensure you are available at the contact details provided in your request.</p>

              <div class="footer">
                <p>Best regards,<br>RubberEco Team</p>
                <p>For any questions, please contact us at support@rubbereco.com</p>
              </div>
            </div>
          </div>
        </body>
        </html>
      `;

    default:
      return `
        <!DOCTYPE html>
        <html>
        <head>${baseStyle}</head>
        <body>
          <div class="container">
            <div class="header">
              <h1>🌱 RubberEco Notification</h1>
            </div>
            <div class="content">
              <h2>Hello ${data.farmerName},</h2>
              <p>Your service request (${data.requestId}) has been updated.</p>

              <div class="footer">
                <p>Best regards,<br>RubberEco Team</p>
              </div>
            </div>
          </div>
        </body>
        </html>
      `;
  }
};

// Create staff application email content
const createStaffApplicationEmailContent = (notificationData) => {
  const data = notificationData.data;
  return `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>New Staff Application</title>
    </head>
    <body style="margin: 0; padding: 0; font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; background-color: #f5f7fa; line-height: 1.6;">
      <div style="max-width: 600px; margin: 20px auto; background-color: #ffffff; border-radius: 12px; box-shadow: 0 4px 20px rgba(0,0,0,0.1); overflow: hidden;">

        <!-- Header -->
        <div style="background: linear-gradient(135deg, #22c55e 0%, #16a34a 100%); padding: 30px 20px; text-align: center; color: white;">
          <div style="font-size: 32px; margin-bottom: 10px;">👷</div>
          <h1 style="margin: 0; font-size: 28px; font-weight: bold;">New Staff Application</h1>
          <p style="margin: 10px 0 0 0; font-size: 16px; opacity: 0.9;">RubberEco Service Application</p>
        </div>

        <!-- Content -->
        <div style="padding: 30px 20px;">
          <h2 style="color: #1f2937; margin-bottom: 20px; font-size: 24px;">Staff Application Received</h2>
          
          <div style="background-color: #f8fafc; padding: 20px; border-radius: 8px; margin-bottom: 20px; border-left: 4px solid #22c55e;">
            <h3 style="color: #22c55e; margin: 0 0 15px 0; font-size: 18px;">Application Details</h3>
            <p style="margin: 8px 0; color: #374151;"><strong>Application ID:</strong> ${data.applicationId}</p>
            <p style="margin: 8px 0; color: #374151;"><strong>Staff Name:</strong> ${data.staffName}</p>
            <p style="margin: 8px 0; color: #374151;"><strong>Staff Role:</strong> ${data.staffRole}</p>
            <p style="margin: 8px 0; color: #374151;"><strong>Staff Email:</strong> ${data.staffEmail}</p>
            <p style="margin: 8px 0; color: #374151;"><strong>Staff Phone:</strong> ${data.staffPhone}</p>
          </div>

          <div style="background-color: #f8fafc; padding: 20px; border-radius: 8px; margin-bottom: 20px; border-left: 4px solid #3b82f6;">
            <h3 style="color: #3b82f6; margin: 0 0 15px 0; font-size: 18px;">Request Details</h3>
            <p style="margin: 8px 0; color: #374151;"><strong>Request ID:</strong> ${data.requestId}</p>
            <p style="margin: 8px 0; color: #374151;"><strong>Farmer Name:</strong> ${data.farmerName}</p>
            <p style="margin: 8px 0; color: #374151;"><strong>Farm Location:</strong> ${data.farmLocation}</p>
            <p style="margin: 8px 0; color: #374151;"><strong>Farm Size:</strong> ${data.farmSize}</p>
            <p style="margin: 8px 0; color: #374151;"><strong>Number of Trees:</strong> ${data.numberOfTrees}</p>
          </div>

          <div style="background-color: #f8fafc; padding: 20px; border-radius: 8px; margin-bottom: 20px; border-left: 4px solid #f59e0b;">
            <h3 style="color: #f59e0b; margin: 0 0 15px 0; font-size: 18px;">Application Metrics</h3>
            <p style="margin: 8px 0; color: #374151;"><strong>Priority Score:</strong> ${data.priorityScore}</p>
            <p style="margin: 8px 0; color: #374151;"><strong>Submitted At:</strong> ${new Date(data.submittedAt).toLocaleString()}</p>
          </div>

          <div style="text-align: center; margin: 30px 0;">
            <p style="color: #6b7280; font-size: 16px;">
              Please review this application and take appropriate action through the admin dashboard.
            </p>
          </div>

          <div style="background-color: #fef3c7; padding: 15px; border-radius: 8px; border: 1px solid #fbbf24;">
            <p style="margin: 0; color: #92400e; font-size: 14px; text-align: center;">
              <strong>Action Required:</strong> This application requires admin review and approval.
            </p>
          </div>
        </div>

        <!-- Footer -->
        <div style="background-color: #f8fafc; padding: 20px; text-align: center; border-top: 1px solid #e5e7eb;">
          <p style="margin: 0; color: #6b7280; font-size: 14px;">
            This is an automated notification from the RubberEco system.<br>
            Please do not reply to this email.
          </p>
        </div>
      </div>
    </body>
    </html>
  `;
};

// Send nursery booking approval email to farmer
const sendNurseryBookingApprovalEmail = async (farmerData, bookingData) => {
  try {
    console.log(`📧 Sending nursery booking approval email to: ${farmerData.farmerEmail}`);

    const transporter = createEmailTransporter();

    const approvalMessage = `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Nursery Booking Approved</title>
      </head>
      <body style="margin: 0; padding: 0; font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; background-color: #f5f7fa; line-height: 1.6;">
        <div style="max-width: 600px; margin: 20px auto; background-color: #ffffff; border-radius: 12px; box-shadow: 0 4px 20px rgba(0,0,0,0.1); overflow: hidden;">

          <!-- Header -->
          <div style="background: linear-gradient(135deg, #22c55e 0%, #16a34a 100%); padding: 30px 20px; text-align: center; color: white;">
            <div style="font-size: 32px; margin-bottom: 10px;">🌱</div>
            <h1 style="margin: 0; font-size: 28px; font-weight: bold;">Nursery Booking Approved!</h1>
            <p style="margin: 5px 0 0 0; font-size: 16px; opacity: 0.9;">Your plant reservation has been confirmed</p>
          </div>

          <!-- Success Alert -->
          <div style="background: linear-gradient(135deg, #10b981 0%, #059669 100%); padding: 20px; text-align: center; color: white;">
            <h2 style="margin: 0; font-size: 20px;">✅ BOOKING CONFIRMED</h2>
            <p style="margin: 5px 0 0 0; font-size: 14px; opacity: 0.9;">Booking ID: ${bookingData._id}</p>
          </div>

          <!-- Content -->
          <div style="padding: 30px 20px;">
            <h2 style="color: #1f2937; margin: 0 0 20px 0; font-size: 24px;">
              Congratulations, <span style="color: #22c55e;">${farmerData.farmerName}</span>!
            </h2>

            <p style="color: #6b7280; font-size: 16px; margin-bottom: 25px;">
              Great news! Your nursery booking has been approved by our team. We will contact you at the earliest for confirming the other details.
            </p>

            <!-- Booking Details -->
            <div style="background: #f0fdf4; border: 2px solid #bbf7d0; border-radius: 10px; padding: 25px; margin: 20px 0;">
              <h3 style="color: #059669; margin: 0 0 20px 0; font-size: 20px; text-align: center; border-bottom: 2px solid #bbf7d0; padding-bottom: 10px;">
                🌿 Booking Details
              </h3>

              <div style="display: grid; gap: 12px;">
                <div style="display: flex; justify-content: space-between; padding: 8px 0; border-bottom: 1px solid #d1fae5;">
                  <strong style="color: #0f172a;">Plant Type:</strong>
                  <span style="color: #1e293b;">${bookingData.plantName}</span>
                </div>

                <div style="display: flex; justify-content: space-between; padding: 8px 0; border-bottom: 1px solid #d1fae5;">
                  <strong style="color: #0f172a;">Quantity:</strong>
                  <span style="color: #1e293b;">${bookingData.quantity} plants</span>
                </div>

                <div style="display: flex; justify-content: space-between; padding: 8px 0; border-bottom: 1px solid #d1fae5;">
                  <strong style="color: #0f172a;">Unit Price:</strong>
                  <span style="color: #1e293b;">₹${bookingData.unitPrice.toLocaleString()}</span>
                </div>

                <div style="display: flex; justify-content: space-between; padding: 8px 0; border-bottom: 1px solid #d1fae5;">
                  <strong style="color: #0f172a;">Total Amount:</strong>
                  <span style="color: #1e293b; font-weight: bold;">₹${bookingData.amountTotal.toLocaleString()}</span>
                </div>

                <div style="display: flex; justify-content: space-between; padding: 8px 0; border-bottom: 1px solid #d1fae5;">
                  <strong style="color: #0f172a;">Advance Paid:</strong>
                  <span style="color: #1e293b;">₹${bookingData.amountAdvance.toLocaleString()} (${bookingData.advancePercent}%)</span>
                </div>

                <div style="display: flex; justify-content: space-between; padding: 8px 0;">
                  <strong style="color: #0f172a;">Balance Amount:</strong>
                  <span style="color: #1e293b;">₹${bookingData.amountBalance.toLocaleString()}</span>
                </div>
              </div>
            </div>

            <!-- Next Steps -->
            <div style="background: #fef3c7; border: 2px solid #fde047; border-radius: 10px; padding: 25px; margin: 20px 0;">
              <h3 style="color: #a16207; margin: 0 0 20px 0; font-size: 20px; text-align: center; border-bottom: 2px solid #fde047; padding-bottom: 10px;">
                📋 What Happens Next?
              </h3>

              <div style="counter-reset: step-counter;">
                <div style="counter-increment: step-counter; display: flex; align-items: center; margin-bottom: 15px; padding: 12px; background: white; border-radius: 8px; border-left: 4px solid #eab308;">
                  <div style="background: #eab308; color: white; width: 24px; height: 24px; border-radius: 50%; display: flex; align-items: center; justify-content: center; font-weight: bold; margin-right: 15px; font-size: 12px;">1</div>
                  <span style="color: #374151;">Our team will contact you within 24-48 hours to confirm delivery details</span>
                </div>

                <div style="counter-increment: step-counter; display: flex; align-items: center; margin-bottom: 15px; padding: 12px; background: white; border-radius: 8px; border-left: 4px solid #eab308;">
                  <div style="background: #eab308; color: white; width: 24px; height: 24px; border-radius: 50%; display: flex; align-items: center; justify-content: center; font-weight: bold; margin-right: 15px; font-size: 12px;">2</div>
                  <span style="color: #374151;">We'll schedule the delivery date and time that works for you</span>
                </div>

                <div style="counter-increment: step-counter; display: flex; align-items: center; margin-bottom: 15px; padding: 12px; background: white; border-radius: 8px; border-left: 4px solid #eab308;">
                  <div style="background: #eab308; color: white; width: 24px; height: 24px; border-radius: 50%; display: flex; align-items: center; justify-content: center; font-weight: bold; margin-right: 15px; font-size: 12px;">3</div>
                  <span style="color: #374151;">Your plants will be delivered to your farm location</span>
                </div>

                <div style="counter-increment: step-counter; display: flex; align-items: center; padding: 12px; background: white; border-radius: 8px; border-left: 4px solid #eab308;">
                  <div style="background: #eab308; color: white; width: 24px; height: 24px; border-radius: 50%; display: flex; align-items: center; justify-content: center; font-weight: bold; margin-right: 15px; font-size: 12px;">4</div>
                  <span style="color: #374151;">Complete payment of the remaining balance upon delivery</span>
                </div>
              </div>
            </div>

            <!-- Important Information -->
            <div style="background: #eff6ff; border: 2px solid #bae6fd; border-radius: 10px; padding: 25px; margin: 20px 0;">
              <h3 style="color: #0369a1; margin: 0 0 20px 0; font-size: 20px; text-align: center; border-bottom: 2px solid #bae6fd; padding-bottom: 10px;">
                ℹ️ Important Information
              </h3>

              <ul style="color: #1e40af; margin: 0; padding-left: 20px;">
                <li style="margin-bottom: 8px;">Please ensure someone is available at the delivery location</li>
                <li style="margin-bottom: 8px;">Keep your contact number active for coordination</li>
                <li style="margin-bottom: 8px;">Have the remaining payment ready for delivery</li>
                <li style="margin-bottom: 8px;">Inspect the plants upon delivery before payment</li>
                <li>Contact us immediately if you have any questions or concerns</li>
              </ul>
            </div>

            <!-- Contact Information -->
            <div style="text-align: center; margin: 30px 0; padding: 20px; background: #f8fafc; border-radius: 8px;">
              <p style="color: #64748b; margin: 0 0 10px 0; font-size: 16px;">
                Need assistance? We're here to help!
              </p>
              <p style="color: #475569; margin: 0; font-size: 14px;">
                📧 Email: admin@rubbereco.com | 📞 Phone: +91 98765 43210
              </p>
            </div>
          </div>

          <!-- Footer -->
          <div style="background: #1f2937; color: #9ca3af; padding: 25px 20px; text-align: center;">
            <div style="margin-bottom: 15px;">
              <div style="font-size: 24px; margin-bottom: 8px;">🌱</div>
              <h4 style="margin: 0; color: #f9fafb; font-size: 18px;">RubberEco Team</h4>
              <p style="margin: 5px 0 0 0; font-size: 14px;">Sustainable Rubber Management System</p>
            </div>

            <div style="border-top: 1px solid #374151; padding-top: 15px; font-size: 12px;">
              <p style="margin: 0;">© 2025 RubberEco. All rights reserved.</p>
              <p style="margin: 5px 0 0 0;">This is an automated message. Please do not reply to this email.</p>
            </div>
          </div>
        </div>
      </body>
      </html>
    `;

    // Create plain text version
    const plainTextMessage = `
═══════════════════════════════════════════════════════════════
🌱 RUBBERECO - NURSERY BOOKING APPROVED 🌱
═══════════════════════════════════════════════════════════════

Congratulations, ${farmerData.farmerName}!

Great news! Your nursery booking has been approved by our team. 
We will contact you at the earliest for confirming the other details.

🌿 BOOKING DETAILS:
───────────────────────────────────────────────────────────────
Plant Type:     ${bookingData.plantName}
Quantity:       ${bookingData.quantity} plants
Unit Price:     ₹${bookingData.unitPrice.toLocaleString()}
Total Amount:   ₹${bookingData.amountTotal.toLocaleString()}
Advance Paid:   ₹${bookingData.amountAdvance.toLocaleString()} (${bookingData.advancePercent}%)
Balance Amount: ₹${bookingData.amountBalance.toLocaleString()}
Booking ID:     ${bookingData._id}

📋 WHAT HAPPENS NEXT:
───────────────────────────────────────────────────────────────
1. Our team will contact you within 24-48 hours to confirm delivery details
2. We'll schedule the delivery date and time that works for you
3. Your plants will be delivered to your farm location
4. Complete payment of the remaining balance upon delivery

ℹ️  IMPORTANT INFORMATION:
───────────────────────────────────────────────────────────────
• Please ensure someone is available at the delivery location
• Keep your contact number active for coordination
• Have the remaining payment ready for delivery
• Inspect the plants upon delivery before payment
• Contact us immediately if you have any questions or concerns

💡 NEED HELP?
───────────────────────────────────────────────────────────────
Email: admin@rubbereco.com
Phone: +91 98765 43210

═══════════════════════════════════════════════════════════════
🌱 RubberEco Team
Sustainable Rubber Management System

© 2025 RubberEco. All rights reserved.
This is an automated message. Please do not reply to this email.
═══════════════════════════════════════════════════════════════
    `;

    const result = await transporter.sendMail({
      from: `"RubberEco Team" <${process.env.EMAIL_USER}>`,
      to: farmerData.farmerEmail,
      subject: `🌱 Nursery Booking Approved - ${bookingData.plantName} | RubberEco`,
      html: approvalMessage,
      text: plainTextMessage
    });

    console.log(`✅ Nursery booking approval email sent successfully to: ${farmerData.farmerEmail}`);
    console.log('Email message ID:', result.messageId);

    return {
      success: true,
      message: 'Nursery booking approval email sent successfully',
      messageId: result.messageId
    };

  } catch (error) {
    console.error('❌ Failed to send nursery booking approval email:', error);
    return {
      success: false,
      message: 'Failed to send nursery booking approval email',
      error: error.message
    };
  }
};

module.exports = {
  sendStaffApplicationConfirmation,
  sendStaffWelcomeEmail,
  sendAdminNotificationEmail,
  sendLeaveApprovalEmail,
  sendLeaveRejectionEmail,
  sendFarmerStaffLeaveNotification,
  testEmailConfig,
  createEmailTransporter,
  sendServiceRequestEmail,
  sendNurseryBookingApprovalEmail
};
