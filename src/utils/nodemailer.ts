// import nodemailer, { Transporter } from 'nodemailer';
// import * as dotenv from 'dotenv';
// dotenv.config();
// import { logger } from '../logger/logger';
// import { RES_TYPES, ERRORTYPES, NotificationTypes } from '../constant';
// import { AppError } from '../utils';

// const transporter: Transporter = nodemailer.createTransport({
//     service: 'Gmail',
//     auth: {
//         user: process.env.MAIL_EMAIL,
//         pass: process.env.MAIL_PASS,
//     },
// });

// export class SendNotificationEmail {
//     constructor(types: string, emails: string, extra: any) {
//         this.sendEmail(types, emails, extra);
//     }

//     async sendEmail(types: string, emails: string, extra: any) {
//         try {
//             let subject = '',
//                 htmlContent = '';
//             switch (types) {
//                 case NotificationTypes.ACTIVE_ACCOUNT:
//                     subject = 'Account Activated';
//                     htmlContent = `
//                                 <html lang="en">
//                                 <head>
//                                     <meta charset="UTF-8" />
//                                     <meta name="viewport" content="width=device-width, initial-scale=1.0" />
//                                     <title>Account Verified</title>
//                                     <style>
//                                     body {
//                                         font-family: Arial, sans-serif;
//                                         line-height: 1.6;
//                                     }

//                                     .container {
//                                         max-width: 600px;
//                                         margin: auto;
//                                         padding: 20px;
//                                         border: 1px solid #ccc;
//                                         box-shadow: 0 4px 8px rgba(0, 0, 0, 0.1);
//                                     }

//                                     h1 {
//                                         color: #333;
//                                     }

//                                     p {
//                                         margin-bottom: 20px;
//                                     }

//                                     .button {
//                                         display: inline-block;
//                                         padding: 10px 20px;
//                                         background-color: #007bff;
//                                         color: #fff;
//                                         text-decoration: none;
//                                         border-radius: 4px;
//                                     }

//                                     .footer {
//                                         margin-top: 20px;
//                                         border-top: 1px solid #ccc;
//                                         padding-top: 20px;
//                                         font-size: 0.9em;
//                                         color: #666;
//                                     }
//                                     </style>
//                                 </head>
//                                 <body>
//                                     <div class="container">
//                                     <h1>Account Verified</h1>
//                                     <p>Dear ${extra.fistname},</p>
//                                     <p>
//                                         We are pleased to inform you that your account has been successfully
//                                         verified by our admin team. You can now access all the features and
//                                         functionalities available for professionals.
//                                     </p>
//                                     <p>To get started, please click the button below:</p>
//                                     <a href="${process.env.SHIDDUCH_URL}/app/project/dashboard" class="button">Access Dashboard</a>
//                                     <p>
//                                         If you encounter any issues or have questions, feel free to contact our
//                                         support team. We're here to help!
//                                     </p>
//                                     <div class="footer">
//                                         <p>Thank you for choosing our platform.</p>
//                                         <p>Best regards,<br />Your Shidduch Team</p>
//                                     </div>
//                                     </div>
//                                 </body>
//                                 </html>
//                                `;
//                     break;

//                 case NotificationTypes.FORGOT_PSW:
//                     subject = 'Forget Password';
//                     htmlContent = `
//                         <html>
//             <head>
//                 <style>
//                     .email-container {
//                         background-color: #f5f5f5;
//                         padding: 20px;
//                         border-radius: 5px;
//                         font-family: Arial, sans-serif;
//                     }
//                     .otp-message{
//                         font-weight:bold;
//                     }
//                 </style>
//             </head>
//             <body>
//                 <div class="email-container">
//                     <h1>Your OTP for Reset-Password </h1>
//                     <p>Hello there!</p>
//                     <p>This is your one-time password (OTP) to verify your account.
//                      Please enter this code within the next 3 minutes:</p>
//                     <p class="otp-message">Yor otp is :- ${extra}</p>
//                     <p>If you did not request an OTP, please ignore this email.</p>
//                     <p>Regards,</p>
//                     <p>Your CRM Team</p>
//                 </div>
//             </body>
//             </html>`;
//                     break;

//                 case NotificationTypes.SEND_CREDENTIAL:
//                     subject = 'Shidduch Login Credential ';
//                     htmlContent = `<html>
//             <head>
//                 <style>
//                     body {
//                         background-color: #f0f0f0;
//                         margin: 0;
//                         padding: 0;
//                         font-family: Arial, sans-serif;
//                     }
//                     .email-container {
//                         background-color: #fff;
//                         width: 80%;
//                         margin: 20px auto;
//                         padding: 20px;
//                         border-radius: 10px;
//                         box-shadow: 0 4px 8px rgba(0, 0, 0, 0.1);
//                     }
//                     h1 {
//                         color: #3498db;
//                         text-align: center;
//                     }
//                     p {
//                         color: #555;
//                         line-height: 1.2;
//                     }
//                     strong {
//                         color: #333;
//                     }
//                     .support-info {
//                         margin-top: 20px;
//                         color: #777;
//                     }
//                     .footer {
//                         margin-top: 20px;
//                         color: #555;
//                     }
//                 </style>
//              </head>
//              <body>
//                <div class="email-container">
//                     <h1>Shidduch Login Credentials</h1>
//                     <p>Hello there!</p>
//                     <p>Your login credentials for the Shidduch system are provided below:</p>
//                     <p><strong>Email:</strong> <b> ${emails} </b></p>
//                     <p><strong>Password:</strong> <b>${extra['password']} </b></p>
//                     <p>Please keep these credentials secure and do not share them with others.</p>
//                     <p>If you have any questions or need assistance, please feel free to contact our support team.</p>
//                     <div class="support-info">
//                         <p>Regards,</p>
//                         <p>Your Shidduch Team</p>
//                     </div>
//                 </div>
//              </body>
//              </html>
// `;
//                     break;

//                 case NotificationTypes.SEND_PROFESSIONAL_SIGNUP_NOTIFICATION:
//                     subject = 'Signed up new shadchan ';
//                     htmlContent = `<html>
//             <head>
//                 <style>
//                     body {
//                         background-color: #f0f0f0;
//                         margin: 0;
//                         padding: 0;
//                         font-family: Arial, sans-serif;
//                     }
//                     .email-container {
//                         background-color: #fff;
//                         width: 80%;
//                         margin: 20px auto;
//                         padding: 20px;
//                         border-radius: 10px;
//                         box-shadow: 0 4px 8px rgba(0, 0, 0, 0.1);
//                     }
//                     h1 {
//                         color: #3498db;
//                         text-align: center;
//                     }
//                     p {
//                         color: #555;
//                         line-height: 1.2;
//                     }
//                      .button {
//                          display: inline-block;
//                          padding: 10px;
//                          background-color: #007bff;
//                          color: #fff;
//                          text-decoration: none;
//                          border-radius: 4px;
//                          font-size:12px;
//                          height: 10px;
//                     }
//                     strong {
//                         color: #333;
//                     }
//                     .support-info {
//                         margin-top: 20px;
//                         color: #777;
//                     }
//                     .footer {
//                         margin-top: 20px;
//                         color: #555;
//                     }
//                 </style>
//              </head>
//              <body>
//                <div class="email-container">
//            <h1>New Shadchan Signed Up,  Verification Required</h1>
//             <p>Dear Admin,</p>
//             <p>
//                 I hope this message finds you well. We have a new Shadchan signup awaiting your verification. Please find the details below:
//             </p>
//             <p><strong>Name:</strong> ${extra['firstname']}</p>
//             <p><strong>Email:</strong> ${extra['email']}</p>
//             <p><strong>Signup Date:</strong> ${extra['date']}</p>
//             <p>
//               You can verify the Shadchan by accessing the admin panel here: <a href="${process.env.SHIDDUCH_URL}/app/project/shadchan" class="button">Verify shadchan</a>
//             </p>
//             <p>
//                 Thank you for your attention and cooperation.
//             </p>
//                 </div>
//              </body>
//              </html>
// `;
//                     break;

//                 default:
//                     throw new AppError(
//                         RES_TYPES.INVALID_NOTIFICATION_TYPE,
//                         ERRORTYPES.INVALID_REQUEST,
//                     );
//             }
//             const mailOptions = {
//                 from: process.env.MAIL_EMAIL,
//                 to: emails,
//                 subject,
//                 html: htmlContent,
//             };

//             await transporter.sendMail(mailOptions);
//             logger.info(`Email sent successfully to ${emails}`);
//         } catch (err) {
//             logger.error(`Error sending email: ${err}`);
//         }
//     }
// }
