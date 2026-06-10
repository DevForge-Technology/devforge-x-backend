export function vendorCredentialsTemplate(name: string, email: string, password: string, portalUrl: string) {
  return `
    <h2>Welcome to DevForge[x]</h2>
    <p>Hi ${name},</p>
    <p>Your vendor account has been created. Use these credentials to sign in:</p>
    <ul>
      <li><strong>Email:</strong> ${email}</li>
      <li><strong>Password:</strong> ${password}</li>
    </ul>
    <p>
      Access the portal here:
      <a href="${portalUrl}" target="_blank" rel="noopener noreferrer">${portalUrl}</a>
    </p>
    <p>Please change your password after your first login.</p>
  `;
}

export function passwordResetTemplate(name: string, email: string, password: string) {
  return `
    <h2>Password Reset — DevForge[x]</h2>
    <p>Hi ${name},</p>
    <p>Your password has been reset by an administrator.</p>
    <ul>
      <li><strong>Email:</strong> ${email}</li>
      <li><strong>New Password:</strong> ${password}</li>
    </ul>
  `;
}
