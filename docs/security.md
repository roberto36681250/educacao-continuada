# Security Guide - Educacao Continuada

## Authentication & Authorization

### JWT Tokens
- Tokens expire in 7 days (configurable via `JWT_EXPIRES_IN`)
- Stored in localStorage on client
- Sent via `Authorization: Bearer` header
- Contains: `sub` (userId), `email`, `iat`, `exp`

### Roles Hierarchy
1. **ADMIN_MASTER**: Full system access
2. **ADMIN**: Hospital admin
3. **MANAGER**: Unit manager (Gestor)
4. **USER**: Regular user (Aluno)

### Protected Endpoints
- Most endpoints require authentication (`@UseGuards(JwtAuthGuard)`)
- Role-based access via `@Roles()` decorator

## Rate Limiting

### Global
- Default: 100 requests/minute per IP

### Endpoint-Specific
| Endpoint | Limit | Window |
|----------|-------|--------|
| `POST /auth/login` | 10 | 1 min |
| `POST /invites/:token/accept` | 10 | 1 min |
| `POST /tickets` | 30 | 1 min |
| `POST /courses/:id/certificates` | 10 | 1 min |

### Rate Limit Response
```json
{
  "statusCode": 429,
  "message": "ThrottlerException: Too Many Requests"
}
```

## Data Protection (LGPD Compliance)

### Sensitive Fields
These fields are never logged or sent to error tracking:
- `password` / `passwordHash`
- `cpf`
- `rawText` (clinical case before anonymization)
- `accessToken`

### Anonymization
- Clinical cases must be anonymized before publication
- Built-in anonymization rules for CPF, phone, email, names
- Admin can configure additional patterns

### Data Retention
- Audit logs: Keep indefinitely (legal requirement)
- Email outbox: Keep for 90 days minimum
- Video progress: Keep while user exists

### User Rights (LGPD)
- Export data: Contact admin
- Delete account: Contact admin (requires audit trail preservation)

## Logging Best Practices

### What We Log
- HTTP method, path, status, duration
- Request ID for correlation
- User ID (when authenticated)
- Error messages and stack traces (5xx only)

### What We NEVER Log
- Passwords
- CPF (raw)
- Raw clinical text
- JWT tokens
- Session cookies

### Log Format (Production)
```json
{
  "level": "info",
  "time": 1234567890,
  "requestId": "uuid",
  "userId": "user-id",
  "method": "GET",
  "url": "/health",
  "statusCode": 200,
  "durationMs": 5
}
```

## Error Tracking (Sentry)

### Captured
- 5xx server errors
- Unhandled exceptions
- Client-side JavaScript errors
- Navigation errors

### Not Captured
- 4xx client errors (expected)
- Development environment errors

### User Context
- User ID and email are attached to errors
- Role is tagged for filtering

## Infrastructure Security

### Database
- Use SSL for all connections
- Use connection pooler (pgbouncer/Supabase)
- Never expose direct connection to public
- Use separate credentials for app vs admin

### API
- CORS restricted to `WEB_URL`
- HTTPS only in production
- No sensitive headers exposed
- Request body size limited

### Secrets Management
- Never commit `.env` files
- Use environment variables
- Rotate secrets periodically
- Different secrets per environment

## Incident Response

### Security Incident Checklist
1. Contain: Block affected accounts/IPs
2. Assess: Check audit logs
3. Notify: Inform affected users if data breach
4. Fix: Patch vulnerability
5. Document: Post-mortem report

### Contact
- Security issues: security@your-domain.com
- Report vulnerabilities responsibly

## Compliance Checklist

### LGPD
- [x] Data anonymization tools
- [x] Audit logging
- [x] User consent (terms on signup)
- [x] Sensitive data redaction in logs
- [ ] Data export feature (manual via admin)
- [ ] Account deletion process (manual via admin)

### Healthcare Data
- [x] Access control by role
- [x] Audit trail for sensitive operations
- [x] Clinical data anonymization
- [x] Certificate verification system

## Security Updates

### Dependencies
```bash
# Check for vulnerabilities
pnpm audit

# Update dependencies
pnpm update
```

### Regular Reviews
- Monthly: Review audit logs
- Quarterly: Update dependencies
- Annually: Security audit
