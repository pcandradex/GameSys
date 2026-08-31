# GameSys

Landing page de autenticação do GameSys, construída com Next.js, React e TypeScript.

## Requisitos

- Node.js 20 ou superior
- npm

## Instalação

```bash
npm install
```

## Executar em desenvolvimento

```bash
npm run dev
```

Acesse:

```text
http://localhost:3000
```

## Build de produção

```bash
npm run build
npm start
```

## Estrutura

```text
gamesys/
├── app/
│   ├── globals.css
│   ├── layout.tsx
│   └── page.tsx
├── components/
│   ├── LoginForm.tsx
│   └── ThemeToggle.tsx
├── .gitignore
├── eslint.config.mjs
├── next-env.d.ts
├── next.config.ts
├── package.json
├── README.md
└── tsconfig.json
```

## Funcionalidades atuais

- Login visual com e-mail e senha
- Mostrar/ocultar senha
- Opção "Lembrar-me"
- Link "Esqueceu a senha?"
- Acesso somente por convite
- Tema escuro e claro
- Toggle de tema animado
- Persistência do tema no `localStorage`
- Layout responsivo
- Glassmorphism
- Visual inspirado na identidade azul da Steam

## Próximas etapas sugeridas

1. Conectar o formulário à API de autenticação.
2. Implementar autenticação JWT ou sessão.
3. Criar fluxo de convite.
4. Criar recuperação de senha.
5. Criar dashboard após o login.
6. Adicionar proteção das rotas privadas.