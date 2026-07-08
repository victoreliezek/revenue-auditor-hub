-- contratos tinha RLS habilitado mas só policies de leitura (nenhuma de
-- UPDATE/INSERT/DELETE). Isso fazia com que atualizarCnpjContrato (usado
-- pelo botão "Editar CNPJ" na apuração de royalties) rodasse um UPDATE que
-- afetava 0 linhas silenciosamente — sem erro, sem toast, sem persistir —
-- porque nenhuma policy autorizava a escrita.
create policy "Admins can update contratos"
  on public.contratos
  for update
  using (has_role(auth.uid(), 'admin'::app_role))
  with check (has_role(auth.uid(), 'admin'::app_role));
