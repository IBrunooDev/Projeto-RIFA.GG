# 🧨 Minha experiência real colocando o RIFA.GG no ar

Eu vi na prática como pode ser perigoso criar um sistema relativamente complexo utilizando IA no estilo Vibe Coding e colocar esse sistema no ar sem ter conhecimento suficiente de arquitetura de software, backend, banco de dados, segurança e testes.

Durante o desenvolvimento, o RIFA.GG parecia estar funcionando muito bem. Eu testava cadastro, login, criação de rifas, reserva de números e painel administrativo, e aparentemente tudo estava funcionando como deveria.

A própria IA me passava a sensação de que as alterações estavam corretas e que o sistema poderia ser utilizado.

Mas quando coloquei o projeto no ar e pessoas reais começaram a utilizar, começaram a aparecer situações que eu nunca tinha imaginado.

No começo foi uma experiência boa. O site chegou a ter cerca de **17 contas cadastradas** e estava funcionando normalmente.

Depois começaram os problemas.

## 🔢 O limite de 5 números

No sistema, ao criar uma rifa, eu podia escolher quantos números seriam vendidos.

Para evitar que uma pessoa reservasse muitos números, pedi para a IA criar uma limitação de **5 números por conta/ID**.

Por exemplo:

```text
Bruno
ID: 1
Máximo: 5 números
```

Na minha cabeça, aquilo resolvia o problema.

Só que uma pessoa percebeu que poderia simplesmente criar outra conta com outro ID.

Exemplo:

```text
Bruno
ID: 1
5 números

Henrique
ID: 2
5 números

Outra conta
ID: 3
5 números
```

Durante o teste, uma pessoa chegou a criar aproximadamente **5 contas diferentes** para continuar reservando números.

Foi nesse momento que fiquei pensando:

> Como isso foi possível se o sistema parecia estar funcionando corretamente?

E foi aí que comecei a entender que o problema não era simplesmente o sistema “funcionar”.

A regra dos 5 números realmente funcionava.

O problema era que ela tinha sido criada pensando apenas no cenário normal de uso e não em alguém tentando contornar aquela regra.

## ⚠️ Contas com ID negativo

Outro problema que apareceu foi ainda mais inesperado.

Algumas pessoas descobriram que era possível criar contas utilizando um ID negativo.

Por exemplo:

```text
Usuário: Bruno
ID: -1
```

Isso obviamente não deveria ser permitido.

Mas o sistema aceitava.

Isso me mostrou que eu não tinha feito uma validação completa dos dados.

Eu estava pensando apenas:

```text
O cadastro funciona?
```

Quando deveria também estar pensando:

```text
Quais valores podem ser enviados?

O backend valida isso?

O banco de dados aceita qualquer número?

O que acontece se alguém modificar a requisição?

O sistema impede valores que não deveriam existir?
```

A validação não deveria existir somente no formulário do site.

O backend e o próprio banco de dados também deveriam possuir regras para impedir dados inválidos.

## 🧠 Foi aí que comecei a entender o verdadeiro problema

O maior problema não era um bug específico.

Era eu estar desenvolvendo um sistema relativamente complexo sem possuir conhecimento suficiente sobre várias áreas importantes.

Eu não dominava completamente:

- Arquitetura de software;
- Backend;
- Banco de dados;
- Segurança;
- Autenticação;
- Autorização;
- Validação de dados;
- Prevenção contra abuso;
- Testes;
- Concorrência;
- Modelagem de dados.

Mesmo assim, com ajuda da IA, eu conseguia criar várias funcionalidades.

E isso pode criar uma sensação perigosa:

> **Se tudo está funcionando, então provavelmente está tudo certo.**

Mas não necessariamente.

O sistema pode funcionar perfeitamente durante os seus testes e ainda possuir dezenas de situações que você nunca imaginou testar.

## 🤖 O que aprendi utilizando IA como Vibe Coder

Eu tive uma experiência muito boa utilizando IA para aprender e desenvolver.

Consegui criar coisas que provavelmente demoraria muito mais tempo para conseguir fazer sozinho naquele momento.

A IA me ajudou com:

- Frontend;
- Banco de dados;
- Funcionalidades;
- Painel administrativo;
- Correção de erros;
- Interfaces;
- Lógica do sistema.

Mas também aprendi uma coisa muito importante:

> **A IA conseguir criar uma funcionalidade não significa que aquela funcionalidade foi projetada corretamente para produção.**

Durante o desenvolvimento eu estava muito preocupado em fazer:

```text
Cadastro funcionar.
Login funcionar.
Rifa funcionar.
Reserva funcionar.
Painel funcionar.
```

Depois que pessoas reais começaram a utilizar, percebi que também deveria perguntar:

```text
Como alguém poderia abusar disso?

Como alguém poderia contornar essa regra?

O que acontece se enviarem um valor inesperado?

O que acontece se criarem várias contas?

O que acontece se modificarem uma requisição?

O banco de dados realmente impede isso?
```

Essa experiência mudou bastante minha visão sobre Vibe Coding.

## 🚨 Por que considero isso perigoso

O Vibe Coding pode ser excelente para estudar, criar protótipos e aprender programação.

Mas ele pode se tornar perigoso quando alguém sem conhecimento suficiente começa a criar sistemas reais envolvendo:

- Login;
- Cadastro;
- Dados pessoais;
- Permissões;
- Pagamentos;
- Vendas;
- Painéis administrativos;
- Informações importantes.

Uma pessoa pode construir um sistema inteiro com IA e acreditar que está seguro simplesmente porque tudo aparentemente funciona.

Eu mesmo passei por isso.

O RIFA.GG parecia estar funcionando muito bem.

Até pessoas reais começarem a utilizar o sistema de maneiras que eu nunca havia imaginado.

Foi aí que percebi que existe uma diferença enorme entre:

> **Fazer um sistema funcionar.**

e:

> **Saber se esse sistema realmente está preparado para ser utilizado por pessoas reais.**

## 📚 Por que decidi publicar este repositório

Decidi publicar este projeto não para dizer:

> “Olha o sistema perfeito que eu fiz com IA.”

Muito pelo contrário.

Quero utilizar este repositório para mostrar minha experiência real utilizando Inteligência Artificial para desenvolver um projeto maior do que o meu conhecimento técnico naquele momento.

Quero mostrar tanto as coisas que deram certo quanto os problemas que encontrei.

Principalmente porque essa experiência me ensinou que programação não é apenas fazer funcionalidades aparecerem na tela.

Também envolve:

- Planejamento;
- Arquitetura;
- Segurança;
- Validação;
- Testes;
- Banco de dados;
- Monitoramento;
- Experiência.

Hoje vejo o RIFA.GG principalmente como um projeto de aprendizado.

E provavelmente esse foi o maior valor que ele me trouxe.

> **Vibe Coding pode fazer você criar algo muito rápido. Mas, quanto mais complexo o sistema fica, mais importante se torna entender realmente o que está acontecendo por trás do código.**

---

## 🛠️ Tecnologias e serviços utilizados

O RIFA.GG foi desenvolvido utilizando uma combinação de tecnologias modernas para aplicações web, com o projeto dividido entre aplicação, versionamento, hospedagem e banco de dados.

### 💻 Tecnologias do projeto

- **Next.js** — framework utilizado para estruturar a aplicação web;
- **TypeScript** — linguagem principal utilizada em grande parte do desenvolvimento;
- **JavaScript** — também utilizado em partes do projeto e na lógica da aplicação;
- **PostgreSQL** — banco de dados utilizado pelo sistema através do Supabase;
- **SQL** — utilizado para criação e alteração de tabelas, funções, regras, permissões e estrutura do banco.

### 🐙 GitHub — código e versionamento

O **GitHub** foi utilizado para armazenar o código-fonte do RIFA.GG e manter o histórico das alterações realizadas durante o desenvolvimento.

```text
Next.js + TypeScript + JavaScript
              ↓
            GitHub
```

O repositório serviu como ponto central do projeto, permitindo organizar o código, acompanhar mudanças e conectar a aplicação com o processo de deploy.

### ▲ Vercel — hospedagem e deploy

A **Vercel** foi utilizada para hospedar e publicar a aplicação.

As versões enviadas para o GitHub eram utilizadas no processo de deploy do projeto, permitindo colocar novas atualizações do RIFA.GG no ar.

```text
GitHub
   ↓
Vercel
   ↓
RIFA.GG publicado
```

### 🟢 Supabase — backend, autenticação e banco de dados

O **Supabase** foi utilizado como parte principal do backend do RIFA.GG.

Por meio dele foram implementadas partes importantes do sistema, incluindo:

- Banco de dados PostgreSQL;
- Autenticação;
- Cadastro de usuários;
- Dados das contas;
- Rifas;
- Reservas de números;
- Compras;
- Cupons;
- Cargos e permissões;
- Funções SQL;
- Regras de acesso;
- Políticas de segurança do banco.

```text
Aplicação
   ↓
Supabase
   ↓
PostgreSQL + Auth + regras do sistema
```

### 🔗 Como tudo foi integrado

A estrutura geral do projeto ficou assim:

```text
Next.js + TypeScript + JavaScript
              ↓
            GitHub
              ↓
            Vercel
              ↓
       Aplicação publicada
              ↓
           Supabase
              ↓
PostgreSQL + Auth + Backend
```

De forma resumida:

- **Next.js** → estrutura da aplicação;
- **TypeScript** → linguagem principal do projeto;
- **JavaScript** → utilizado em partes da lógica da aplicação;
- **GitHub** → código-fonte e versionamento;
- **Vercel** → hospedagem e deploy;
- **Supabase** → backend, autenticação e integração com o banco;
- **PostgreSQL** → banco de dados;
- **SQL** → estrutura, funções, regras e permissões do banco.

Essa combinação permitiu colocar o RIFA.GG no ar rapidamente e também foi uma parte importante do aprendizado que tive sobre desenvolvimento web, backend, banco de dados, deploy e segurança.

---

## 🗄️ Banco de dados para testes

Os arquivos SQL utilizados no projeto estão disponíveis na pasta `supabase/`.

Eles servem como referência para criar a estrutura do banco de dados em um ambiente próprio de testes, utilizando Supabase/PostgreSQL.

> **Importante:** este projeto é experimental e pode exigir ajustes antes de funcionar completamente em outro ambiente.

Antes de testar, configure suas próprias variáveis de ambiente e credenciais. Não utilize chaves, senhas ou tokens de terceiros.

---

## 💬 Minha visão depois dessa experiência

O RIFA.GG deu problema em vários momentos e teve falhas que eu não esperava, mas também me deu uma experiência muito forte de como um sistema se comporta em produção com pessoas reais usando a plataforma.

Foi muito diferente de apenas testar tudo sozinho.

Quando usuários começaram a criar contas, reservar números, tentar contornar limitações e encontrar situações que eu nunca tinha previsto, eu consegui entender na prática como desenvolvimento real envolve muito mais do que simplesmente fazer uma funcionalidade funcionar.

Mesmo com todos os problemas, essa experiência me ensinou muito sobre:

- Produção;
- Comportamento de usuários reais;
- Backend;
- Banco de dados;
- Validação;
- Segurança;
- Testes;
- Arquitetura;
- Correção de falhas.

No fim, o RIFA.GG não foi um projeto perfeito — e justamente por isso acabou sendo uma experiência de aprendizado muito valiosa.

> **Ver pessoas reais usando algo que eu criei, encontrando erros e explorando os limites do sistema me fez aprender coisas que eu provavelmente não aprenderia apenas testando o projeto sozinho.**


---

## 📘 Guia completo de instalação

Quer testar o RIFA.GG em um ambiente próprio?

Preparei um guia detalhado mostrando o passo a passo para configurar o projeto utilizando **GitHub + Vercel + Supabase**, incluindo banco de dados, variáveis de ambiente e deploy.

➡️ **[Baixar / abrir o PDF — Guia de Instalação do RIFA.GG](docs/RIFA.GG-Guia-Instalacao-GitHub-Vercel-Supabase.pdf)**

> O guia é destinado a ambiente de estudo e testes. Utilize suas próprias credenciais e revise as configurações de segurança antes de qualquer uso real.

---

## 🎮 Sobre o projeto RIFA.GG

O **RIFA.GG** foi desenvolvido como um sistema de rifas para uso dentro de um servidor de **GTA San Andreas**, utilizando a plataforma **Multi Theft Auto (MTA)**.

O projeto foi criado especificamente para o ambiente do **Legacy RP**, servindo como uma experiência prática de desenvolvimento aplicada a um servidor de roleplay.

Todo o sistema nasceu nesse contexto e foi utilizado principalmente como projeto de estudo, teste e aprendizado sobre desenvolvimento web, banco de dados, backend, segurança e uso de Inteligência Artificial no processo de criação de software.
