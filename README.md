# Flow agendas — API com FastAPI e Supabase

## Sobre o projeto

Este backend faz parte da Agenda Estudantil. A ideia é permitir que o sistema cadastre, liste, consulte, atualize e exclua informações por meio de uma API feita com FastAPI, conectada ao Supabase pela Data API (HTTPS).

As tabelas são criadas manualmente no SQL Editor do Supabase. A API não cria nem altera a estrutura do banco. Os modelos Pydantic servem para validar os dados que entram e saem da aplicação.

## 1. Tecnologias

- Python 3.10 ou superior
- FastAPI e Uvicorn
- Supabase Python Client
- Pydantic
- python-dotenv
- PostgreSQL, por meio do Supabase

A conexão é feita por HTTPS usando o cliente Supabase. Este modelo não utiliza SQLAlchemy nem psycopg2.

## 2. Organização dos arquivos

Uma organização possível para o backend é:

```text
projeto/
├── agenda_estudantil.sql
└── backend/
    ├── controller/
    │   └── ...
    ├── models/
    │   └── ...
    ├── .env
    ├── .env.example
    ├── .gitignore
    ├── database.py
    ├── main.py
    └── requirements.txt
```

Os arquivos dentro de `controller/` e `models/` dependem das tabelas e rotas implementadas pela equipe. O script `agenda_estudantil.sql` guarda a estrutura do banco.

## 3. Criar as tabelas no Supabase

1. Acesse o painel do projeto Supabase.
2. Abra **SQL Editor**.
3. Cole o conteúdo de `agenda_estudantil.sql` e execute no banco correto.
4. Abra **Table Editor** e confira se as tabelas apareceram.agenda_estudantil

Para listar as tabelas do esquema `public`, também é possível executar:

```sql
SELECT table_name
FROM information_schema.tables
WHERE table_schema = 'public'
  AND table_type = 'BASE TABLE'
ORDER BY table_name;
```

O banco da Agenda Estudantil tem várias tabelas relacionadas por chaves estrangeiras. Portanto, ao implementar o CRUD, escolha a tabela que será trabalhada e respeite os relacionamentos, campos obrigatórios e restrições definidos no SQL.

**Importante:** se o script já tiver sido executado, algumas instruções `CREATE TABLE` poderão falhar porque as tabelas já existem. Confira o estado do banco antes de executar novamente e não apague dados sem confirmar que é seguro.

## 4. Preparar o ambiente Python

Abra o terminal na pasta `backend` e crie um ambiente virtual.

### Windows — Prompt de Comando

```bat
python -m venv venv
venv\Scripts\activate.bat
python -m pip install --upgrade pip
pip install -r requirements.txt
```

### Windows — PowerShell

```powershell
python -m venv venv
.\venv\Scripts\Activate.ps1
python -m pip install --upgrade pip
pip install -r requirements.txt
```

Se o PowerShell bloquear a ativação, use o Prompt de Comando.

### Linux

```bash
python3 -m venv venv
source venv/bin/activate
python -m pip install --upgrade pip
pip install -r requirements.txt
```

Depois da instalação, confira se não houve erros. Para verificar conflitos entre dependências, execute:

```bash
python -m pip check
```

O `requirements.txt` contém as versões informadas para o projeto. Se alguma dependência não instalar, confira a versão do Python e a mensagem apresentada pelo `pip`.

## 5. Configurar o acesso ao Supabase

No painel do Supabase, copie a **Project URL** e uma chave secreta válida para o backend. Crie `backend/.env` com os dados do seu projeto:

```env
SUPABASE_URL="https://SEU_PROJETO.supabase.co"
SUPABASE_KEY="SUA_CHAVE_SECRETA"
```

Troque os valores de exemplo pelos dados reais. A URL e a chave devem ser do mesmo projeto.

Crie também um arquivo `.env.example` para mostrar quais variáveis são necessárias, sem colocar nele nenhuma chave real:

```env
SUPABASE_URL="https://SEU_PROJETO.supabase.co"
SUPABASE_KEY="COLOQUE_SUA_CHAVE_LOCALMENTE"
```

O arquivo `database.py` deve carregar essas variáveis e criar o cliente Supabase. Mantenha o `.env` na pasta `backend`, ao lado desse arquivo.

No `.gitignore`, inclua:

```gitignore
.env
venv/
.venv/
__pycache__/
*.pyc
```

Não envie o `.env` para o GitHub nem compartilhe a chave secreta em capturas de tela. Essa chave deve ficar apenas no backend. Para os testes locais, mantenha a API em `127.0.0.1`; uma API sem autenticação não deve ser publicada para acesso público.

## 6. Implementar o CRUD

Cada tabela precisa de modelos Pydantic compatíveis com os nomes e tipos das colunas e de um controller que execute as operações usando o cliente Supabase.

O guia de referência usa a tabela `clientes`, mas ela é apenas um exemplo. Na Agenda Estudantil, substitua os nomes e campos pelos da tabela escolhida pela equipe.

| Operação | Método e rota de exemplo | Resultado esperado |
|---|---|---|
| Listar | `GET /recurso` | `200 OK` e uma lista |
| Cadastrar | `POST /recurso` | `201 Created` e o registro criado |
| Consultar um registro | `GET /recurso/{id}` | `200 OK` ou `404 Not Found` |
| Atualizar | `PUT /recurso/{id}` | `200 OK` ou `404 Not Found` |
| Excluir | `DELETE /recurso/{id}` | `204 No Content` ou `404 Not Found` |

Esses caminhos são exemplos; as rotas reais dependem do código implementado. Não considere uma rota pronta só porque está listada neste documento.

Nas operações sobre um registro específico, use um filtro pela chave primária. No exemplo do guia, seria `.eq("id_cliente", id_cliente)`. Na tabela escolhida para a Agenda Estudantil, use o nome real da chave primária. Não faça atualização nem exclusão sem esse filtro.

Como existem chaves estrangeiras no banco, os registros referenciados precisam existir antes de inserir os dados dependentes. Confira também as regras `NOT NULL`, `CHECK` e `ON DELETE` do script SQL.

## 7. Iniciar a API

Com o ambiente virtual ativado e o terminal na pasta `backend`, execute:

```bash
python -m uvicorn main:app --reload --host 127.0.0.1
```

O comando presume que existe um arquivo `main.py` com uma instância FastAPI chamada `app`. Se o projeto usar nomes diferentes, ajuste `main:app`.

Quando o servidor iniciar, acesse:

- Swagger: http://127.0.0.1:8000/docs
- ReDoc: http://127.0.0.1:8000/redoc

A página `/docs` mostra as rotas que estão registradas de verdade na aplicação. Se as rotas não aparecerem, confira se os controllers foram incluídos em `main.py`.

## 8. Testar as rotas

Use somente dados fictícios. No Swagger, abra uma rota, clique em **Try it out**, preencha os campos e execute. Também é possível testar pelo Postman usando `http://127.0.0.1:8000` como endereço base.

Para uma tabela já implementada, execute esta sequência. Troque `/recurso`, os campos e o ID pelos valores reais:

| Etapa | Requisição | O que conferir |
|---|---|---|
| 1 | `GET /recurso` | `200` e lista de registros |
| 2 | `POST /recurso` | `201` e registro criado |
| 3 | `GET /recurso/{id}` | `200` e dados cadastrados |
| 4 | `PUT /recurso/{id}` | `200` e dados atualizados |
| 5 | `GET /recurso/{id}` | A alteração foi salva |
| 6 | `DELETE /recurso/{id}` | `204`, sem corpo |
| 7 | `GET /recurso/{id}` | `404`, se esse for o comportamento definido para um ID inexistente |

Use o ID retornado pelo POST; não presuma que será `1`. No PUT, envie todos os campos exigidos pelo modelo se a rota usar atualização completa.

Faça também um teste de validação, por exemplo enviando um campo obrigatório ausente ou um valor que viole uma regra do modelo. Dados que não passam pela validação Pydantic normalmente recebem `422 Unprocessable Entity`.

Por fim, abra o **Table Editor** do Supabase e confirme que o registro foi criado e atualizado e que a exclusão foi persistida.
