-- Adiciona permissão view.reforma_tributaria ao perfil auditor
INSERT INTO role_permissions (role, permission_key, allowed, updated_at)
VALUES ('auditor', 'view.reforma_tributaria', true, now())
ON CONFLICT (role, permission_key) DO UPDATE SET allowed = true, updated_at = now();
