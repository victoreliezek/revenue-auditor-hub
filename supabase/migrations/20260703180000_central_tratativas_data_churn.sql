-- Campo "Data do Churn" já criado no pipe Pipefy Tratativas (307196408), fase Perdido (343394578),
-- field id "data_do_churn". Esta coluna espelha esse campo via sync_pipefy_tratativas.py.
alter table central_tratativas add column if not exists data_churn date;
