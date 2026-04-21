1. Nếu dùng Railway DB/Redis từ local
Vào Railway dashboard → project → service (Postgres/Redis) → Connect tab, lấy:

Biến	Ví dụ
DATABASE_URL	postgresql://user:pass@containers-us-west-xxx.railway.app:5432/railway
REDIS_URL	redis://default:pass@containers-us-west-xxx.railway.app:6379
Paste vào backend/.env:


DATABASE_URL=postgresql+asyncpg://user:pass@...railway.app:5432/railway
REDIS_URL=redis://default:pass@...railway.app:6379
2. Nếu chạy local hoàn toàn (Docker Compose)
Không cần thông tin Railway gì cả — docker-compose.yml đã tự tạo Postgres + Redis local. Chỉ cần Docker Desktop chạy.

3. Khi deploy backend lên Railway
Railway tự inject các biến môi trường. Bạn cần set thủ công trong Railway dashboard → service → Variables:


DATABASE_URL     = (Railway tự cấp nếu dùng Postgres plugin)
REDIS_URL        = (Railway tự cấp nếu dùng Redis plugin)
SECRET_KEY       = your-secret
ALGORITHM        = HS256
Với frontend (nếu deploy riêng):


VITE_API_URL     = https://your-api.up.railway.app
VITE_WS_URL      = wss://your-api.up.railway.app
Tóm lại: Để chạy local không cần Railway — chỉ cần Docker Desktop. Railway chỉ cần khi bạn muốn deploy production hoặc dev local kết nối vào DB cloud.

Local thì tôi vẫn muốn kết nối tới database của raiway mà bạn ?
Vào Railway dashboard → project → Postgres service → tab Connect → copy Database URL.

Paste vào backend/.env:


DATABASE_URL=postgresql+asyncpg://postgres:password@containers-us-west-xxx.railway.app:5432/railway
Và Redis tương tự nếu dùng Redis của Railway:


REDIS_URL=redis://default:password@containers-us-west-xxx.railway.app:6379
Sau đó chạy backend local (không cần Docker):


cd backend
uvicorn app.main:app --reload --port 8000
Không cần docker compose up nữa — chỉ chạy backend process trực tiếp, kết nối thẳng tới Railway DB qua internet.

Lưu ý: Railway Postgres URL mặc định dùng postgresql:// — bạn cần đổi thành postgresql+asyncpg:// vì project dùng SQLAlchemy async driver.

Vậy khi này app ở local kết nối vẫn tạo đc vận động viên các tính năng 100% hoạt động đúng ko
Đúng, 100% tính năng hoạt động — vì backend local chỉ là process, database thật vẫn là Railway.

Tuy nhiên có một điểm cần lưu ý:

WebSocket (tính năng mới vừa làm)
WebSocket scoring chạy in-memory qua MatchWSManager. Khi chạy local:

Nếu chỉ 1 instance (local dev) → hoạt động bình thường
Nếu Railway cũng đang chạy song song → 2 instance tách biệt, judge local và judge trên Railway không nhìn thấy nhau qua WS
→ Khi test local thì tắt Railway backend hoặc chỉ dùng một trong hai.

Còn lại hoạt động bình thường:
Đăng ký vận động viên ✅
Tạo giải đấu, bracket ✅
Chấm điểm Quyền ✅
Lịch thi đấu ✅
Kết quả, huy chương ✅
Checklist để chạy:

# 1. backend/.env — đổi DATABASE_URL + REDIS_URL thành Railway
# 2. Chạy backend
cd backend && uvicorn app.main:app --reload --port 8000

# 3. Chạy frontend
cd frontend && npm run dev
Frontend .env giữ nguyên VITE_API_URL=http://localhost:8000.