-- Nickname escolhido pelo próprio usuário, usado como nome de exibição em
-- todo o sistema (cards, dashboard etc). O login continua sendo por e-mail;
-- isso é só um campo de exibição, sem relação com autenticação.
alter table public.profiles add column nickname text;
