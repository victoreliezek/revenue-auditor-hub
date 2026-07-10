-- Motivo do churn passa a ter duas partes no Pipefy (pipe Tratativas 307196408,
-- fase Perdido 343394578): campo select "Categoria do Churn" (field_id
-- categoria_do_churn, opções fechadas) e o campo de texto livre existente
-- "Motivo do Churn" (field_id motivo_do_churn), que agora funciona como
-- observação. sync_pipefy_tratativas.py passa a gravar a categoria em
-- central_tratativas.motivo (como antes) e o texto livre nesta nova coluna.
alter table central_tratativas add column if not exists observacao text;
