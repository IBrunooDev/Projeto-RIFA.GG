# Segurança antes de publicar

Este pacote foi preparado para publicação como projeto de estudo.

- Nenhum arquivo `.env` com valores reais deve ser commitado.
- `.env.example` contém apenas nomes de variáveis vazias.
- Chaves do Supabase, senha administrativa, segredo de sessão e webhook do Discord devem ser configurados apenas no ambiente local ou na plataforma de deploy.
- Se alguma credencial real já tiver sido publicada anteriormente em outro repositório, ela deve ser revogada/rotacionada no serviço correspondente.
- O projeto é experimental e deve passar por revisão técnica e de segurança antes de qualquer uso em produção.
