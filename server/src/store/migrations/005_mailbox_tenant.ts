// Office 365 mailboxes can sit in different Entra tenants; NULL keeps the common endpoint.
export const mailboxTenant = `
ALTER TABLE mailboxes ADD COLUMN oauth_tenant text;
`;
