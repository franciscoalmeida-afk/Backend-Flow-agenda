import os
from dotenv import load_dotenv
from supabase import create_client

load_dotenv()

url = os.getenv("SUPABASE_URL")
key = os.getenv("SUPABASE_KEY")

print("Lendo URL:", url)
print("Lendo KEY:", key[:15] if key else "VAZIA", "...")

try:
    c = create_client(url, key)
    r = c.table("instituicao").select("*").limit(1).execute()
    print("✅ CONEXAO COM O SUPABASE OK!")
except Exception as e:
    print("❌ Erro:", e)