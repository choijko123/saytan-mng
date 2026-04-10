# Саятан Quiz App — Deploy заавар (Шинэчлэгдсэн)

## 1. Firebase тохиргоо

### 1.1 Firebase Project үүсгэх
1. https://console.firebase.google.com → Create a project → `saitan-quiz`

### 1.2 Authentication идэвхжүүлэх
- Authentication → Get started → Email/Password → Enable → Save

### 1.3 Firestore Database үүсгэх
- Firestore Database → Create database → **Start in test mode** → asia-east1

### 1.4 Firestore Security Rules
Firebase Console → Firestore → Rules дээр дараах rules-ийг оруулна:
```
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    match /users/{userId} {
      allow read: if request.auth != null;
      allow write: if request.auth != null && request.auth.uid == userId;
    }
    match /questions/{questionId} {
      allow read: if request.auth != null;
      allow write: if request.auth != null
        && request.auth.token.email == "admin@yourdomain.com";
    }
  }
}
```
> ⚠️ `admin@yourdomain.com` оронд өөрийн admin имэйлийг оруул

### 1.5 Web App нэмэх
Project Overview → </> → App nickname → Register → firebaseConfig хуулах

---

## 2. Environment variables тохируулах

`.env.example` файлыг `.env` болгон хуулаад мэдээллийг бөглөнө:

```bash
cp .env.example .env
```

```env
REACT_APP_FIREBASE_API_KEY=AIzaSy...
REACT_APP_FIREBASE_AUTH_DOMAIN=your-project.firebaseapp.com
REACT_APP_FIREBASE_PROJECT_ID=your-project-id
REACT_APP_FIREBASE_STORAGE_BUCKET=your-project.firebasestorage.app
REACT_APP_FIREBASE_MESSAGING_SENDER_ID=000000000000
REACT_APP_FIREBASE_APP_ID=1:000000000000:web:abc123
REACT_APP_ADMIN_EMAIL=admin@yourdomain.com
```

> ⚠️ `.env` файлыг **ХЭЗЭЭ Ч** git-д commit хийж болохгүй!

---

## 3. Суулгаж ажиллуулах

```bash
npm install
npm start
```

---

## 4. Vercel дээр deploy

```bash
git init
git add .
git commit -m "init"
# GitHub repo үүсгэж push
```

1. vercel.com → GitHub-аар нэвтрэх → New Project → repo сонгох
2. **Environment Variables** хэсэгт `.env`-ийн бүх утгуудыг нэмнэ
3. Deploy → `https://saitan-quiz.vercel.app`

---

## 5. Admin эрх тохируулах

1. `.env` файлд `REACT_APP_ADMIN_EMAIL=таны@имэйл.com` гэж бичнэ
2. Firebase Console → Firestore Rules-д тухайн имэйлийг оруулна
3. Тэр имэйлээр бүртгүүлж нэвтэрвэл navbar-т ⚙️ Админ цэс гарна

---

## 6. Асуулт нэмэх арга

### 6.1 Admin Panel ашиглах (хялбар)
- Нэвтэрч ороод navbar-т **⚙️ Админ** → **➕ Нэмэх** tab

### 6.2 JSON Import (олон асуулт нэг дор)
Admin → **📥 JSON Import** tab дор дараах форматаар:
```json
[
  {
    "q": "Асуулт энд?",
    "opts": ["А хариулт", "Б хариулт", "В хариулт", "Г хариулт"],
    "a": 2,
    "diff": 1,
    "cat": "Газарзүй"
  }
]
```
- `a` — зөв хариултын индекс (0=А, 1=Б, 2=В, 3=Г)
- `diff` — 1=Хялбар, 2=Дунд, 3=Хэцүү
- `cat` — Ерөнхий, Газарзүй, Түүх, Шинжлэх ухаан, Математик, Технологи, Спорт, Урлаг, Соёл

---

## Апп-ын боломжууд

- ✅ Firebase Authentication (бүртгэл/нэвтрэх)
- ✅ Firestore дахь асуулт (динамик, admin удирдана)
- ✅ Admin panel — нэмэх/засах/устгах/хайх/шүүх
- ✅ JSON bulk import
- ✅ 20 секундийн таймер + хэцүүлгийн заалт
- ✅ Firestore дахь дэлхийн ранк (real-time)
- ✅ Профайл хуудас
- ✅ Toast мэдэгдлийн систем
- ✅ Bug-free timer & double-fire protection
- ✅ Environment variables — нууц мэдээлэл хамгаалагдсан
