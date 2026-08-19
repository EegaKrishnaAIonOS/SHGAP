# SHGAP Project Structure Analysis

## Complete Guide for New Team Members

---

## 1. Project Root Directory

**Location:** `/home/ec2-user/projects/lakshmiSHG/`

**Project Name:** SHGAP (Smart Helping Group AI Platform / SHG Market Linkage Platform)

**Description:** An AI-enabled Smart Market Linkage Platform for Self Help Group (SHG) Products. A Proof of Concept for the Andhra Pradesh State Government (MEPMA). This is a **monorepo** using **Turborepo + npm workspaces** to manage multiple interdependent services.

---

## 2. Important Folders and Files

### **Root Level Structure**

```
lakshmiSHG/
├── package.json                 # Root workspace config (Node.js 20+, npm 10+)
├── turbo.json                   # Turborepo configuration (build orchestration)
├── tsconfig.base.json           # Shared TypeScript base configuration
├── eslint.config.js             # Shared ESLint rules
├── README.md                    # Project overview and quick-start
├── Proof of Concept Scope.docx  # Full functional requirements
├── SHG_POC_Development_Sprint_Plan.xlsx # Sprint breakdown (T01-T24)
│
├── apps/                        # Main application services
│   ├── web/                     # Frontend (React PWA)
│   ├── core-api/                # Backend API (NestJS)
│   ├── ml-services/             # ML models (Python FastAPI)
│   ├── notification-service/    # Notification handler (NestJS)
│   └── voice-service/           # Voice/Speech service (Python FastAPI)
│
├── packages/                    # Shared libraries
│   └── shared-types/            # Shared TypeScript type definitions
│
├── database/                    # Database schema and migrations
│   ├── prisma/
│   │   ├── schema.prisma        # Data model (PostgreSQL schema)
│   │   └── migrations/          # Migration history
│   └── seed/                    # Master data initialization
│
├── infra/                       # Infrastructure as Code
│   ├── docker-compose.yml       # Local dev services
│   ├── docker-compose.apps.yml  # All 5 containerized apps
│   ├── docker-compose.monitoring.yml # Prometheus/Grafana/Loki stack
│   ├── k8s/                     # Kubernetes manifests
│   ├── terraform/               # AWS Terraform configs
│   └── scripts/                 # Deployment/backup scripts
│
└── docs/                        # Documentation
    ├── README.md                # Architecture overview
    ├── deployment-guide.md      # How to deploy (real vs. unapplied)
    ├── data-model.md            # ERD + data dictionary
    ├── ml-model-cards.md        # ML model documentation
    ├── adr/                     # Architecture Decision Records
    └── runbooks/                # Operational procedures
```

---

## 3. Purpose of Each Folder and Important Files

### **apps/web/** — Frontend Application

- **Tech Stack:** React 18 + TypeScript + Vite (build tool) + Tailwind CSS
- **Purpose:** Single PWA (Progressive Web App) serving:
  - SHG members' mobile-first registration and product management
  - Officials' data-dense dashboards
  - Admin interfaces
- **Key Features:**
  - Installable on mobile/desktop
  - Works offline (service worker + IndexedDB)
  - Telugu/English localization (react-i18next)
  - Responsive design (phone → desktop)
  - Camera/mic access for product images and voice
- **Ports:** `5173` (Vite dev server)
- **Entry Point:** `src/main.tsx` → `src/App.tsx`

### **apps/core-api/** — Central Backend API

- **Tech Stack:** NestJS (Node.js framework) + TypeScript
- **Purpose:** Core business logic API
- **Responsibilities:**
  - Authentication & Authorization (JWT-based, OTP via SMS, email+password)
  - User/Role management (RBAC — Role-Based Access Control)
  - SHG registry (product catalog)
  - Buyer registry
  - Analytics aggregation
  - Notification orchestration
  - Product image management (virus-scanned, resized via ClamAV + Sharp)
- **Modules:**
  - `auth/` — OTP, email, password flows
  - `users/` — User management
  - `shgs/` — Self Help Group data
  - `products/` — Product CRUD + images
  - `buyers/` — Buyer registry
  - `recommendations/` — Integration with ML matching
  - `analytics/` — Data aggregation
  - Others: `admin/`, `audit/`, `geo/`, `consent/`, etc.
- **Port:** `3000`
- **API Docs:** Swagger at `http://localhost:3000/api/docs`
- **Entry Point:** `src/main.ts`

### **apps/ml-services/** — Machine Learning Services

- **Tech Stack:** Python 3.11+ + FastAPI + APScheduler (job scheduling)
- **Purpose:** AI/ML inference and batch processing
- **Key Services:**
  1. **Categorization** — Auto-suggest product categories using sentence embeddings
  2. **Market Intelligence** — Price forecasting (Prophet/XGBoost) + demand prediction
  3. **Scheme Guidance** — RAG (Retrieval-Augmented Generation) for government schemes
  4. **Buyer Matching** — Recommend best buyer matches for SHG products
- **Pipeline Automation:**
  - Feature pipeline (daily) — processes raw market data into features
  - Training pipeline (weekly) — retrains forecasting models
  - Ranker training — LightGBM model for recommendation re-ranking
- **Port:** `8001`
- **Entry Point:** `run.py` → `app/main.py`

### **apps/notification-service/** — Notification Microservice

- **Tech Stack:** NestJS + BullMQ (job queue)
- **Purpose:** Asynchronous notification delivery
- **Channels:** SMS, WhatsApp, Voice (IVR), Email
- **Events:** OTP, buyer inquiries, price alerts, tender opportunities
- **Port:** `3001`

### **apps/voice-service/** — Voice/Speech Processing

- **Tech Stack:** Python + FastAPI
- **Purpose:** Speech interaction
- **Features:**
  - ASR (Automatic Speech Recognition) — using Bhashini AI4Bharat
  - TTS (Text-to-Speech)
  - NLU (Natural Language Understanding)
  - Dialogue management
  - RAG integration
- **Port:** `8002`

### **database/** — Data Layer

- **Prisma Schema** (`prisma/schema.prisma`):
  - Full PostgreSQL schema definition
  - Uses PostgreSQL extensions: PostGIS (geospatial), pgvector (AI embeddings), pgcrypto (PII encryption)
  - Enums for statuses, roles, types
  - Relationships and constraints
- **Migrations** (`prisma/migrations/`):
  - Version-controlled database changes
- **Seed Data** (`seed/`):
  - Master data initialization
  - Demo sales data for testing

### **infra/** — Infrastructure

- **docker-compose.yml** — Local development services:
  - PostgreSQL (port 55432) — main database
  - Redis (port 6379) — caching/job queue
  - MinIO (ports 9000, 9001) — S3-compatible file storage
  - ClamAV (port 3310) — virus scanning
- **docker-compose.apps.yml** — All 5 production-like containerized apps
- **docker-compose.monitoring.yml** — Prometheus, Grafana, Loki, Alertmanager
- **k8s/** — Kubernetes configs (blue/green, HPA, Ingress)
- **terraform/** — AWS infrastructure (ap-south-1 Mumbai region)

### **docs/** — Documentation

- **adr/** — Architecture Decision Records (0001-0033+):
  - ADR-0001: React PWA frontend
  - ADR-0002: NestJS backend
  - ADR-0003: Python ML services
  - ADR-0004: PostgreSQL + PostGIS + pgvector
  - ADR-0023: Agmarknet API for price data
  - ADR-0024: Prophet/XGBoost forecasting
  - ADR-0033: Prometheus monitoring
- **data-model.md** — ERD and data dictionary
- **deployment-guide.md** — Deployment procedures
- **runbooks/** — Incident response and operational procedures

---

## 4. Entry Points of the Application

### **Frontend Entry Point**

- **File:** `apps/web/src/main.tsx`
- **Flow:** `main.tsx` → `App.tsx` (root component)
- **Starts:** Vite dev server on port 5173 (dev) or built static files (prod)

### **Backend (Core API) Entry Point**

- **File:** `apps/core-api/src/main.ts`
- **Bootstrap Process:**
  1. Creates NestFactory app with AppModule
  2. Applies Helmet security middleware
  3. Sets up ValidationPipe (DTO validation)
  4. Configures Swagger documentation
  5. Listens on port 3000 (or $PORT env var)

### **ML Services Entry Point**

- **File:** `apps/ml-services/run.py`
- **Bootstrap Process:**
  1. Sets Windows event loop policy (if needed)
  2. Imports FastAPI app from `app/main.py`
  3. Starts uvicorn server on port 8001
  4. Initializes APScheduler for background jobs

### **Notification Service Entry Point**

- **File:** `apps/notification-service/src/main.ts`
- **Similar to core-api, serves async notifications**

### **Voice Service Entry Point**

- **File:** `apps/voice-service/app/main.py`
- **Similar to ml-services, handles voice/speech**

---

## 5. How the Application Starts and Request Flow

### **Local Development Startup**

```bash
# 1. Install all dependencies (Node + Python packages)
npm install
cd apps/ml-services && python -m venv .venv && ./.venv/Scripts/pip install -r requirements-dev.txt
cd ../voice-service && python -m venv .venv && ./.venv/Scripts/pip install -r requirements-dev.txt

# 2. Start infrastructure (Postgres, Redis, MinIO, ClamAV)
docker compose -f infra/docker-compose.yml up -d

# 3. Setup database (migrations + seed data)
cd database && npm run migrate:deploy && npm run seed

# 4. Run all services via Turbo (handles dev servers automatically)
npm run dev
```

### **Request Flow Example: User Login with OTP**

```
[User's Browser/Mobile]
         ↓
    Phone # + OTP
         ↓
[Frontend - React App on localhost:5173]
    - User enters phone
    - POST /auth/request-otp
         ↓
[Core API - NestJS on localhost:3000]
    - AuthController.requestOtp()
    - AuthService.requestOtp()
         ↓
    [SMS Service via Notification Service on :3001]
         - Send OTP via SMS

    [Redis on :6379]
         - Store OTP hash (temp)
         ↓
    Returns: { message: "OTP sent" }
         ↓
    [User enters OTP]
         ↓
    POST /auth/verify-otp with { phone, otp }
         ↓
[Core API]
    - AuthService.verifyOtp()
    - Validates OTP against Redis
    - Generates JWT access + refresh tokens
         ↓
[Database - PostgreSQL on :55432]
    - Create/update User record
    - Add UserRole assignments
         ↓
    Returns: { accessToken, refreshToken }
         ↓
[Frontend]
    - Stores tokens in secure storage
    - Sets Authorization: Bearer <accessToken>
    - Redirects to dashboard
```

### **Request Flow Example: Product Recommendation (ML Integration)**

```
[User: SHG Admin]
    Wants to see buyer matches for their products
         ↓
[Frontend]
    GET /recommendations/{shgId}
         ↓
[Core API - RecommendationsController]
    .getForShg(shgId)
         ↓
    Calls RecommendationsService
         ↓
    [ML Services on :8001]
        GET /matching/candidates?shg_id={shgId}&top_k=10
             ↓
        [ML Pipeline]
        1. Fetch products for SHG from DB
        2. Fetch all buyers from DB
        3. Compute product embeddings (Sentence-Transformers)
        4. Compute buyer embeddings
        5. Calculate similarity scores (cosine)
        6. Apply scoring function:
           - Content match (product-buyer category fit)
           - Demand estimate (Prophet forecast)
           - Price match (XGBoost price prediction)
           - LightGBM ranker (if trained on feedback)
        7. Rank by score and return top 10
             ↓
        Returns: [
            {
                buyer_id: "xyz",
                buyer_name: "Rajesh Wholesale",
                score: 0.87,
                explanation: "Matches 95% by category, high demand"
            },
            ...
        ]
         ↓
[Core API]
    - Saves recommendations to `recommendations` table
    - Returns with match scores
         ↓
[Database]
    - Persists Recommendation rows
    - Tracks status (PENDING/ACCEPTED/REJECTED)
         ↓
[Frontend]
    - Displays buyer list with scores
    - User can ACCEPT or REJECT each
    - Feedback sent back → retrains ranker
```

### **Request Flow: Product Image Upload**

```
[User on Web]
    Selects product image file
         ↓
[Frontend]
    POST /products/{id}/images (multipart/form-data)
         ↓
[Core API - ProductsController]
    .uploadImage() with FileInterceptor
         ↓
[ProductImagesService]
    1. Validate file size (max 8MB)
    2. Check MIME type
         ↓
    [ClamAV on :3310]
        - Scan for viruses
         ↓
    [Sharp Image Library]
        - Resize image
        - Generate thumbnails
         ↓
    [MinIO on :9000]
        - Upload resized images to S3-compatible storage
         ↓
[Database]
    - Save ProductImage metadata
         ↓
[Frontend]
    Returns: { imageId, url, thumbnailUrl }
```

---

## 6. Agents and Framework

**This project does NOT use autonomous AI agents in the code itself.**

However, it _serves_ as an AI-enabled platform with several ML components:

### **ML Models (Not Agents, But AI Components)**

| Component             | Type                           | Framework                    | Purpose                            |
| --------------------- | ------------------------------ | ---------------------------- | ---------------------------------- |
| **Categorization**    | Embedding Model                | Sentence-Transformers        | Classify products into categories  |
| **Demand Forecaster** | Time-Series Model              | Prophet                      | Predict product demand             |
| **Price Forecaster**  | Ensemble Model                 | XGBoost + Prophet            | Predict market prices              |
| **Buyer Ranker**      | Classification Model           | LightGBM                     | Rank recommendation candidates     |
| **RAG System**        | Retrieval-Augmented Generation | TBD (scheme guidance)        | Answer questions about gov schemes |
| **Speech/NLU**        | ASR/TTS + NLU                  | Bhashini AI4Bharat + FastAPI | Voice interaction                  |

### **Background Job Scheduler (Acts Like an "Agent")**

**APScheduler** in `ml-services/app/main.py`:

- Runs feature pipeline every 24 hours
- Runs model training every 168 hours (7 days)
- Runs ranker training every 168 hours
- Any job failure is logged; scheduler continues running

```python
# From ml-services/app/main.py
scheduler.add_job(
    scheduled_run,
    trigger=IntervalTrigger(hours=24),
    id="feature_pipeline"
)
scheduler.add_job(
    scheduled_training_run,
    trigger=IntervalTrigger(hours=168),  # Weekly
    id="model_training"
)
```

---

## 7. How Agents/Components Interact

There are no autonomous agents. Instead, the system has **coordinated microservices** that interact as follows:

### **Interaction Diagram**

```
┌─────────────┐
│   Frontend  │ (React PWA)
│  (web app)  │
└──────┬──────┘
       │ HTTP(S)
       ▼
┌─────────────────────┐
│   Core API          │ (NestJS)
│ - Auth              │
│ - User/SHG Registry │
│ - Products          │◄──────┐
│ - Recommendations   │       │
└──────┬──────────────┘       │
       │ HTTP                 │
       ├─────────────────┬──────────┤
       │                 │          │
       ▼                 ▼          ▼
   ┌─────────────┐  ┌──────────┐  ┌──────────────┐
   │ML Services  │  │Notif Svc │  │Voice Service │
   │(FastAPI)    │  │(NestJS)  │  │(FastAPI)     │
   │ - Category  │  │ - SMS    │  │ - ASR/TTS    │
   │ - Forecast  │  │ - Email  │  │ - NLU        │
   │ - Match     │  │ - WhatsApp│ │ - RAG        │
   │ - Scheme    │  │ - Voice  │  │              │
   └──────┬──────┘  └────┬─────┘  └──────┬───────┘
          │              │               │
          └──────┬───────┴───────────────┘
                 │ Database queries
                 ▼
          ┌────────────────┐
          │  PostgreSQL    │
          │  + PostGIS     │
          │  + pgvector    │
          └────────────────┘
                 ▲
                 │ File/Cache access
          ┌─────┴─────────┐
          │               │
       ┌──────┐      ┌──────┐
       │Redis │      │MinIO │
       │(cache│      │(files│
       │queue)│      │store)│
       └──────┘      └──────┘
```

### **Key Interaction Patterns**

1. **Synchronous (Request/Response):**
   - Frontend → Core API → Database
   - Core API → ML Services → Database
   - ML Services access shared features in Postgres

2. **Asynchronous (Job Queue):**
   - Core API → Redis/BullMQ → Notification Service
   - Notifications sent via SMS/Email/WhatsApp/Voice

3. **Scheduled Background Jobs:**
   - APScheduler in ML Services runs pipelines independently
   - Writes results back to Postgres
   - Core API reads results for display

4. **File Storage:**
   - Core API uploads images to MinIO
   - ML Services may read images for processing
   - Frontend displays images from MinIO URLs

---

## 8. Purpose of schemas.py and Model Files

### **What Are Schemas and Models?**

In Python (FastAPI), schemas are **Pydantic models** that define the shape of data. They're like DTOs (Data Transfer Objects) in NestJS.

**Location:** `apps/ml-services/app/*/schemas.py`

### **Example: Categorization Schemas**

**File:** `apps/ml-services/app/categorization/schemas.py`

```python
# Request schema (what the API accepts)
class CategorizeRequest(BaseModel):
    name: str                      # Product name (required)
    description: str | None = None # Optional description

# Response schema (what the API returns)
class CategorySuggestion(BaseModel):
    category_id: str
    category_name: str
    parent_category_name: str | None
    score: float  # Cosine similarity 0-1 (confidence)

class CategorizeResponse(BaseModel):
    suggestions: list[CategorySuggestion]
```

**Usage:**

```python
# In router.py
@router.post("/categorize", response_model=CategorizeResponse)
async def categorize(
    request: CategorizeRequest,  # ← Pydantic validates request
    service: CategorizationService = Depends(get_categorization_service)
) -> CategorizeResponse:  # ← Response is validated before returning
    suggestions = await service.suggest(request.name, request.description, ...)
    return CategorizeResponse(suggestions=suggestions)
```

### **Other Schema Files**

- **`market_intelligence/schemas.py`** — Price/demand forecast request/response
- **`matching/schemas.py`** — Recommendation request/response
- **`scheme_guidance/schemas.py`** — Scheme query request/response

### **Comparison: NestJS DTOs**

In the **core-api** (NestJS), schemas are called **DTOs** (Data Transfer Objects):

**File:** `apps/core-api/src/products/dto/create-product.dto.ts`

```typescript
// Request DTO
export class CreateProductDto {
  name: string;
  description: string;
  categoryId: string;
  price: number;
  availableQuantity: number;
  unit: string;  // e.g., "kg", "dozen"
}

// Usage
@Post()
create(@CurrentUser() user, @Body() dto: CreateProductDto) {
  return this.productsService.create(user.sub, dto);
}
```

### **Database Models: Prisma Schema**

**File:** `database/prisma/schema.prisma`

The Prisma schema defines **database models** — the actual data structure in PostgreSQL:

```prisma
model Product {
  id            String    @id @default(uuid()) @db.Uuid
  shgId         String    @map("shg_id") @db.Uuid
  name          String    @db.VarChar(255)
  description   String?
  categoryId    String    @map("category_id") @db.Uuid
  price         Decimal   @db.Numeric(10, 2)
  availableQty  Int       @map("available_qty")
  location      Unsupported("geography(POINT, 4326)")  # PostGIS geospatial
  createdAt     DateTime  @default(now()) @map("created_at")
  updatedAt     DateTime  @updatedAt @map("updated_at")

  shg           Shg       @relation(fields: [shgId], references: [id], onDelete: Cascade)
  category      Category  @relation(fields: [categoryId], references: [id])
  images        ProductImage[]

  @@map("products")
}

model Recommendation {
  id            String              @id @default(uuid()) @db.Uuid
  shgId         String              @map("shg_id") @db.Uuid
  buyerId       String              @map("buyer_id") @db.Uuid
  matchScore    Decimal             @map("match_score") @db.Numeric(5, 4)
  status        RecommendationStatus @default(PENDING)
  respondedAt   DateTime?           @map("responded_at")

  shg           Shg                 @relation(fields: [shgId], references: [id])
  buyer         Buyer               @relation(fields: [buyerId], references: [id])

  @@map("recommendations")
}
```

---

## 9. API Endpoints Overview

### **Core API (NestJS) - Port 3000**

#### **Authentication Endpoints** (`/auth`)

| Method | Endpoint                    | Description                                 |
| ------ | --------------------------- | ------------------------------------------- |
| POST   | `/auth/request-otp`         | Send OTP to phone                           |
| POST   | `/auth/verify-otp`          | Verify OTP → get JWT tokens                 |
| POST   | `/auth/refresh`             | Exchange refresh token for new access token |
| POST   | `/auth/logout`              | Revoke refresh token                        |
| POST   | `/auth/register`            | Self-register (email+password)              |
| POST   | `/auth/verify-email`        | Confirm email → ACTIVE or PENDING_APPROVAL  |
| POST   | `/auth/resend-verification` | Request new verification email              |
| POST   | `/auth/login`               | Email+password login                        |
| POST   | `/auth/forgot-password`     | Request password reset link                 |
| POST   | `/auth/reset-password`      | Reset password with token                   |

#### **Product Endpoints** (`/products`)

| Method | Endpoint                          | Description                           |
| ------ | --------------------------------- | ------------------------------------- |
| POST   | `/products`                       | Create product (owner/admin)          |
| GET    | `/products`                       | List products (paginated, filterable) |
| GET    | `/products/nearby`                | Find products within radius           |
| GET    | `/products/{id}`                  | Get single product                    |
| PATCH  | `/products/{id}`                  | Update product (owner/admin)          |
| DELETE | `/products/{id}`                  | Delete product (owner/admin)          |
| POST   | `/products/{id}/images`           | Upload product image                  |
| DELETE | `/products/{id}/images/{imageId}` | Delete image                          |

#### **Recommendations Endpoints** (`/recommendations`)

| Method | Endpoint                        | Description                  |
| ------ | ------------------------------- | ---------------------------- |
| GET    | `/recommendations/{shgId}`      | Get buyer matches for SHG    |
| PATCH  | `/recommendations/{id}/respond` | Accept/reject recommendation |

#### **Users Endpoints** (`/users`)

| Method | Endpoint      | Description                    |
| ------ | ------------- | ------------------------------ |
| GET    | `/users/{id}` | Get user profile               |
| PATCH  | `/users/{id}` | Update profile                 |
| etc.   | ...           | Role assignment, consent, etc. |

#### **Health Endpoints**

| Method | Endpoint        | Description                       |
| ------ | --------------- | --------------------------------- |
| GET    | `/health`       | Liveness check                    |
| GET    | `/health/ready` | Readiness check (DB connectivity) |

### **ML Services (FastAPI) - Port 8001**

#### **Categorization** (`/categorize`)

| Method | Endpoint      | Description                             |
| ------ | ------------- | --------------------------------------- |
| POST   | `/categorize` | Suggest product categories by name/desc |

#### **Market Intelligence** (`/market-intelligence`)

| Method | Endpoint                                | Description              |
| ------ | --------------------------------------- | ------------------------ |
| POST   | `/market-intelligence/refresh-features` | Trigger feature pipeline |
| GET    | `/market-intelligence/feature-status`   | Check last pipeline run  |
| POST   | `/market-intelligence/train-models`     | Trigger model training   |
| GET    | `/market-intelligence/prices`           | Query real market prices |

#### **Price Forecasting** (`/forecast`)

| Method | Endpoint                       | Description         |
| ------ | ------------------------------ | ------------------- |
| GET    | `/forecast/demand/{productId}` | Get demand forecast |
| GET    | `/forecast/price/{commodity}`  | Get price forecast  |

#### **Buyer Matching** (`/matching`)

| Method | Endpoint                                 | Description              |
| ------ | ---------------------------------------- | ------------------------ |
| GET    | `/matching/candidates?shg_id=X&top_k=10` | Ranked buyer candidates  |
| POST   | `/matching/refresh-embeddings`           | Recompute all embeddings |
| POST   | `/matching/train-ranker`                 | Train LightGBM re-ranker |

#### **Scheme Guidance** (`/scheme-guidance`)

| Method | Endpoint                 | Description                |
| ------ | ------------------------ | -------------------------- |
| POST   | `/scheme-guidance/query` | RAG search for gov schemes |

#### **Health**

| Method | Endpoint        | Description                       |
| ------ | --------------- | --------------------------------- |
| GET    | `/health`       | Liveness check                    |
| GET    | `/health/ready` | Readiness check (DB connectivity) |
| GET    | `/metrics`      | Prometheus metrics                |

### **Notification Service (NestJS) - Port 3001**

Async event-driven; doesn't expose HTTP endpoints directly. Subscribes to Redis job queue.

### **Voice Service (FastAPI) - Port 8002**

Handles ASR/TTS/NLU; endpoints TBD based on schema.

---

## 10. Example Request Trace: "SHG Gets Buyer Recommendations"

Let's trace one complete request from the frontend through all services to get buyer matches.

### **Scenario:**

A SHG member named "Ramesh" (user ID: `user-123`) wants to see which buyers might buy his products. He clicks "Get Matches" in the web app.

### **Step-by-Step Trace:**

#### **1. Frontend Request**

```javascript
// apps/web/src/pages/ProductsPage.tsx
const response = await fetch(`http://localhost:3000/recommendations/shg-456`, {
  headers: {
    Authorization: `Bearer eyJhbGc...`, // JWT access token from login
  },
});
```

#### **2. Core API Receives Request**

```
HTTP GET /recommendations/shg-456
Headers: Authorization: Bearer eyJhbGc...
↓
[IdentityThrottlerGuard] — Rate limit check (100 req/min per user)
↓
[JwtAuthGuard] — Decode JWT, extract user ID (user-123)
↓
[RecommendationsController.getForShg(shgId='shg-456', userId='user-123')]
```

#### **3. Authorization Check**

```typescript
// RecommendationsController
getForShg(shgId, userId, isAdmin) {
  // Check: user owns the SHG or is admin
  if (userId !== shgId.ownerId && !isAdmin) {
    throw ForbiddenException();
  }
  return this.recommendationsService.getForShg(shgId, userId, isAdmin);
}
```

#### **4. Call ML Services**

```typescript
// RecommendationsService.getForShg()
async getForShg(shgId) {
  // Call ML Services HTTP API
  const mlResponse = await this.httpService.get(
    `http://ml-services:8001/matching/candidates?shg_id=${shgId}&top_k=10`
  );
  return mlResponse.candidates;  // [{ buyer_id, score, ... }, ...]
}
```

#### **5. ML Services Pipeline**

```python
# ml-services/app/matching/router.py
@router.get("/matching/candidates")
async def candidates(shg_id: str, top_k: int = 10) -> dict:
    results = await pipeline.compute_recommendations_for_shg(
        shg_id,
        _embedder,  # Sentence-Transformers model
        top_k
    )
    return {"shg_id": shg_id, "candidates": results}
```

#### **6. ML Pipeline Execution**

```python
# ml-services/app/matching/pipeline.py
async def compute_recommendations_for_shg(shg_id, embedder, top_k):
    # 1. Fetch SHG's products from Postgres
    products = await fetch_products(shg_id=shg_id)
    # Output: [Product(id, name, category, ...), ...]

    # 2. Fetch all buyers from Postgres
    buyers = await fetch_buyers()
    # Output: [Buyer(id, name, categories_interested, ...), ...]

    # 3. Compute product embeddings (if not cached)
    product_embeddings = {}
    for product in products:
        embedding = embedder.encode(product.name + " " + product.description)
        product_embeddings[product.id] = embedding
    # Cache in Redis if configured

    # 4. Compute buyer embeddings
    buyer_embeddings = {}
    for buyer in buyers:
        buyer_text = buyer.name + " " + " ".join(buyer.categories_interested)
        embedding = embedder.encode(buyer_text)
        buyer_embeddings[buyer.id] = embedding

    # 5. Calculate similarity scores
    candidates = []
    for buyer in buyers:
        # Content similarity: avg cosine of product-buyer pairs
        content_score = 0.0
        for product in products:
            sim = cosine_similarity(
                product_embeddings[product.id],
                buyer_embeddings[buyer.id]
            )  # Returns 0-1
            content_score += sim
        content_score /= len(products)  # Average

        # Demand estimate: sum next 30 days' forecasted demand
        # (uses Prophet model trained on sales history)
        demand_estimate = await demand_estimate.predict(
            product_id=products[0].id,
            horizon_days=30
        )

        # Price match: does forecasted price fit buyer's budget?
        # (uses XGBoost model trained on market prices)
        price_forecast = await market_intelligence.forecast_price(
            commodity=products[0].category
        )
        price_score = 1.0 if price_forecast in buyer.budget_range else 0.5

        # Composite score
        score = (
            0.5 * content_score +      # 50% category fit
            0.3 * (demand_estimate / 100) +  # 30% demand
            0.2 * price_score          # 20% price
        )

        candidates.append({
            "buyer_id": buyer.id,
            "buyer_name": buyer.name,
            "score": score,
            "explanation": f"Matches {content_score*100:.0f}% by category, "
                          f"high demand of {demand_estimate} units"
        })

    # 6. Apply re-ranker if trained
    if ranker_model_exists():  # LightGBM model trained on feedback
        candidates = ranking.rerank(candidates, feedback_data)

    # 7. Sort and return top K
    candidates.sort(key=lambda x: x["score"], reverse=True)
    return candidates[:top_k]
    # Output: [
    #   {buyer_id, buyer_name, score: 0.87, explanation: "..."},
    #   {buyer_id, buyer_name, score: 0.82, explanation: "..."},
    #   ...
    # ]
```

#### **7. Database Queries During ML Pipeline**

**Query 1:** Fetch products for SHG

```sql
SELECT id, name, description, category_id, created_at
FROM products
WHERE shg_id = 'shg-456';
```

**Query 2:** Fetch all buyers

```sql
SELECT id, name, categories_interested, budget_range, ...
FROM buyers;
```

**Query 3:** Fetch historical sales (for demand forecast)

```sql
SELECT product_id, quantity, sale_date
FROM sales
WHERE product_id IN (product-id-1, product-id-2, ...)
AND sale_date >= NOW() - INTERVAL '90 days';
```

**Query 4:** Fetch price history (for price forecast)

```sql
SELECT commodity, district, price, arrival_date
FROM agmarknet_prices
WHERE commodity = 'Tomato'
ORDER BY arrival_date DESC
LIMIT 365;
```

#### **8. ML Model Inference**

**Demand Forecast (Prophet):**

```
Input: Historical sales time series
       [Date, Quantity]
       2026-08-01, 50
       2026-08-02, 45
       2026-08-03, 48
       ...
Output: Forecast for next 30 days
        Expected: ~1,200 units
```

**Price Forecast (XGBoost):**

```
Input: Market features
       - Seasonal: August (monsoon)
       - Commodity: Tomato
       - District: Krishna
       - Historical avg: 40 Rs/kg
Output: Forecasted price
        Expected: 35-45 Rs/kg
```

#### **9. Response Back to Core API**

```json
{
  "shg_id": "shg-456",
  "candidates": [
    {
      "buyer_id": "buyer-001",
      "buyer_name": "Rajesh Wholesale Pvt Ltd",
      "score": 0.87,
      "explanation": "Matches 95% by category, high demand of 1200 units in next 30 days"
    },
    {
      "buyer_id": "buyer-002",
      "buyer_name": "Fresh Retail Chain",
      "score": 0.82,
      "explanation": "Matches 88% by category, medium demand"
    },
    ...
  ]
}
```

#### **10. Core API Persists to Database**

```typescript
// RecommendationsService.getForShg()
for (const candidate of mlResponse.candidates) {
  // Save to database
  const recommendation = await this.prisma.recommendation.create({
    data: {
      shgId: shgId,
      buyerId: candidate.buyer_id,
      matchScore: candidate.score,
      status: "PENDING",
      explanation: candidate.explanation,
    },
  });
}

// Return to frontend
return {
  shgId: shgId,
  recommendations: mlResponse.candidates,
  generatedAt: new Date(),
};
```

**Database Write:**

```sql
INSERT INTO recommendations (id, shg_id, buyer_id, match_score, status, explanation, created_at)
VALUES ('rec-uuid-1', 'shg-456', 'buyer-001', 0.87, 'PENDING', '...', NOW()),
       ('rec-uuid-2', 'shg-456', 'buyer-002', 0.82, 'PENDING', '...', NOW()),
       ...;
```

#### **11. Frontend Displays Results**

```javascript
// Response from Core API
const data = await response.json();

// Render recommendations in React component
{
  data.recommendations.map((rec) => (
    <RecommendationCard
      buyerName={rec.buyer_name}
      score={rec.score}
      explanation={rec.explanation}
      onAccept={() => sendResponse(rec.id, "ACCEPTED")}
      onReject={() => sendResponse(rec.id, "REJECTED")}
    />
  ));
}
```

#### **12. User Feedback Loop**

When Ramesh clicks **"Accept"** on Rajesh Wholesale:

```javascript
PATCH /recommendations/rec-uuid-1/respond
{
  "status": "ACCEPTED",
  "feedback": "Interested in discussing"
}
```

```typescript
// RecommendationsService.respond()
await this.prisma.recommendation.update({
  where: { id: "rec-uuid-1" },
  data: {
    status: "ACCEPTED",
    respondedAt: new Date(),
  },
});

// Feedback is used to retrain LightGBM ranker
// Next time, similar buyer-SHG pairs score higher
```

---

## 11. Configuration, Environment Variables, and Dependencies

### **Environment Variables**

#### **Core API** (`apps/core-api/.env`)

```bash
NODE_ENV=development                              # development|production|test
PORT=3000                                         # Server port

# Database
DATABASE_URL=postgresql://shgap:password@localhost:55432/shgap?schema=public

# Redis
REDIS_URL=redis://localhost:6379

# JWT Tokens
JWT_ACCESS_SECRET=your-secret-key-here
JWT_REFRESH_SECRET=your-refresh-secret-key
JWT_ACCESS_EXPIRES_IN=15m                         # 15 minutes
JWT_REFRESH_EXPIRES_IN=7d                         # 7 days

# OTP
OTP_LENGTH=6                                      # SMS OTP digits
OTP_EXPIRY_MINUTES=10

# Email
MAIL_HOST=smtp.gmail.com
MAIL_PORT=587
MAIL_USER=your-email@gmail.com
MAIL_PASSWORD=your-app-password

# SMS (Twilio or similar)
SMS_PROVIDER=twilio
TWILIO_ACCOUNT_SID=your-sid
TWILIO_AUTH_TOKEN=your-token

# MinIO (Object Storage)
MINIO_ENDPOINT=localhost:9000
MINIO_ACCESS_KEY=shgap
MINIO_SECRET_KEY=shgap_dev_password
MINIO_BUCKET_NAME=shgap-products

# ClamAV (Virus Scanning)
CLAMAV_HOST=localhost
CLAMAV_PORT=3310

# Other
LOG_LEVEL=debug
```

#### **ML Services** (`apps/ml-services/.env`)

```bash
# Database
DATABASE_URL=postgresql://shgap:password@localhost:55432/shgap

# Embedding Model
EMBEDDING_MODEL_NAME=sentence-transformers/paraphrase-multilingual-MiniLM-L12-v2

# Agmarknet API (Market Price Data)
AGMARKNET_RESOURCE_ID=9ef84268-d588-465a-a308-a864a43d0070
AGMARKNET_API_KEY=579b464db66ec23bdd000001cdd3946e44ce4aad7209ff7b23ac571b
AGMARKNET_STATE=Andhra Pradesh

# Pipeline Schedules
FEATURE_PIPELINE_INTERVAL_HOURS=24
TRAINING_PIPELINE_INTERVAL_HOURS=168            # Weekly

# Model Training Thresholds
MIN_DEMAND_TRAINING_DAYS=30                      # Min historical data
MIN_PRICE_TRAINING_ROWS=30                       # Min price records
MIN_FEEDBACK_ROWS_FOR_RANKER=30                  # Min for LightGBM

# File Storage
FEATURE_STORE_DIR=./data/features
PRICE_HISTORY_DIR=./data/price_history
MODEL_REGISTRY_DIR=./data/models
```

### **Key Dependencies**

#### **Frontend (React)**

```json
{
  "react": "^18.x",
  "react-dom": "^18.x",
  "vite": "^5.x", // Build tool
  "react-router-dom": "^6.x", // Routing
  "react-i18next": "^13.x", // i18n (Telugu/English)
  "react-query": "^3.x", // Server state management
  "tailwindcss": "^3.x", // Styling
  "axios": "^1.x", // HTTP client
  "pydantic": "^2.x" // Data validation (if needed)
}
```

#### **Core API (NestJS)**

```json
{
  "@nestjs/common": "^10.x",
  "@nestjs/core": "^10.x",
  "@nestjs/platform-express": "^10.x",
  "@nestjs/config": "^3.x", // Config management
  "@nestjs/jwt": "^10.x", // JWT auth
  "@nestjs/passport": "^10.x", // Passport strategies
  "@nestjs/schedule": "^4.x", // @Cron decorators
  "@nestjs/swagger": "^7.x", // API documentation
  "@nestjs/throttler": "^6.x", // Rate limiting
  "prisma": "^5.x", // ORM
  "class-validator": "^0.14.x", // DTO validation
  "helmet": "^8.x", // Security headers
  "ioredis": "^5.x", // Redis client
  "minio": "^8.x", // S3-compatible storage
  "sharp": "^0.35.x", // Image resizing
  "prom-client": "^15.x" // Prometheus metrics
}
```

#### **ML Services (Python)**

```
fastapi>=0.104.0
uvicorn>=0.24.0
psycopg[binary,asyncio]>=3.1         # PostgreSQL async driver
pydantic>=2.0
pandas>=2.0
numpy>=1.24
scikit-learn>=1.3
prophet>=1.1                          # Time-series forecasting
xgboost>=2.0                          # Gradient boosting
lightgbm>=4.0                         # Ranking model
sentence-transformers>=2.2            # Text embeddings
apscheduler>=3.10                     # Job scheduling
prometheus-client>=0.18               # Metrics
python-dotenv>=1.0                    # Env var loading
```

#### **Notification Service (NestJS)**

```json
{
  "@nestjs/bullmq": "^10.x", // Job queue
  "bullmq": "^5.x",
  "twilio": "^3.x", // SMS/WhatsApp
  "nodemailer": "^6.x" // Email
}
```

#### **Database (Prisma)**

```json
{
  "prisma": "^5.x",
  "@prisma/client": "^5.x"
}
```

---

## 12. Complete Architecture in Simple Terms

### **For Someone New to This Project**

Imagine you're an SHG member in Andhra Pradesh. You grow tomatoes and want to sell them to big buyers. Here's how SHGAP helps you:

#### **What SHGAP Does (Simple Version)**

```
YOU (SHG Member)
    ↓
[Use a mobile app to list your products]
    ↓
[System learns about your products]
    ↓
[AI finds buyers who want your products]
    ↓
[You see who wants to buy]
    ↓
[You connect with buyers]
    ↓
[You make sales!]
```

#### **The Technology Stack (What Runs Behind the Scenes)**

```
1. FRONTEND (What you see on your phone/computer)
   ├─ React App (React PWA)
   ├─ Works offline (no internet needed temporarily)
   └─ Available in Telugu + English

2. BACKEND (The central office that processes requests)
   ├─ NestJS API (like a smart dispatcher)
   ├─ Handles your login
   ├─ Manages your product listings
   ├─ Stores your data safely
   └─ Runs 24/7

3. AI/ML BRAIN (The smart assistant)
   ├─ Categorizes products (understands what you're selling)
   ├─ Predicts market prices (tells you how much you can get)
   ├─ Forecasts demand (estimates how many buyers want it)
   └─ Finds best buyer matches (recommends who to sell to)

4. NOTIFICATIONS (The messenger)
   ├─ Sends SMS alerts
   ├─ Sends WhatsApp messages
   ├─ Calls you with voice updates
   └─ Sends emails

5. STORAGE (The filing cabinet)
   ├─ PostgreSQL database (main files, secure with encryption)
   ├─ Redis cache (quick access, like a speed boost)
   └─ MinIO storage (photo files of products)

6. VOICE SERVICE (Talk to the system)
   ├─ Understand your voice (ASR)
   ├─ Speak back to you (TTS)
   └─ Answer questions in Telugu
```

#### **How a Typical User Journey Works**

```
STEP 1: SIGNUP/LOGIN
├─ You enter your phone number
├─ System sends SMS with OTP
├─ You enter OTP
└─ You're logged in! ✓

STEP 2: CREATE PROFILE
├─ You fill in your SHG details
├─ You upload photos
├─ System scans for viruses (safe)
└─ Profile saved ✓

STEP 3: LIST PRODUCTS
├─ You add product (Tomato)
├─ Name, description, price, quantity
├─ Upload photos
├─ AI suggests category automatically ("Vegetables")
└─ Product listed ✓

STEP 4: GET BUYER MATCHES
├─ You click "Find Buyers"
├─ System queries database for all your products
├─ AI computes similarity (embedding models)
├─ AI forecasts your demand (Prophet model)
├─ AI estimates market price (XGBoost model)
├─ AI ranks buyers (LightGBM model)
└─ Returns top 10 matches ✓

STEP 5: RESPOND TO RECOMMENDATIONS
├─ You see buyer names + match scores
├─ You accept or reject each
├─ System learns from your feedback
├─ Next time, recommendations get smarter ✓

STEP 6: CONNECT WITH BUYER
├─ You see buyer's contact info
├─ You call/message buyer directly
├─ You negotiate and make a sale! ✓
```

#### **Key Concepts Explained**

| Term               | What It Means                           | In This Project                                  |
| ------------------ | --------------------------------------- | ------------------------------------------------ |
| **Monorepo**       | Multiple projects in one folder         | 5 apps + database + shared code                  |
| **Microservices**  | Different services doing different jobs | API, ML, Notifications, Voice                    |
| **JWT Token**      | Secure ID card for users                | After login, token proves who you are            |
| **API**            | Way apps talk to each other             | Frontend talks to backend via HTTP               |
| **Database**       | Where all data is stored                | PostgreSQL with products, users, recommendations |
| **ML Model**       | AI that learns patterns                 | Prophet predicts demand, XGBoost predicts price  |
| **Embedding**      | Convert text to numbers                 | "Tomato" → [0.2, 0.8, 0.1, ...] for similarity   |
| **Recommendation** | Suggest best options                    | "You should sell to Rajesh Wholesale"            |
| **Cache**          | Fast temporary storage                  | Redis stores frequently accessed data            |
| **Queue**          | Jobs waiting to run                     | BullMQ sends SMS asynchronously                  |

#### **Where Data Flows**

```
USER'S PHONE (Frontend)
    ↓ (HTTP Request)
CORE API (NestJS)
    ├→ PostgreSQL (Read/Write data)
    ├→ Redis (Cache, Queue)
    ├→ MinIO (Store images)
    └→ ML Services (Get recommendations)
        ↓
    ML SERVICES (FastAPI)
        ├→ PostgreSQL (Read products/buyers)
        ├→ Run ML models (embedding, forecasting)
        └→ Return matches
    ↓ (HTTP Response)
USER'S PHONE (Updated view)
```

#### **Deployment Architecture**

```
LOCAL DEVELOPMENT
├─ Running on your laptop
├─ All services in Docker containers
├─ Database on port 55432
└─ Web app on localhost:5173

PRODUCTION (AWS Mumbai)
├─ Kubernetes cluster
├─ Blue/Green deployment (zero downtime)
├─ Auto-scaling (handle more users automatically)
├─ Monitoring (Prometheus + Grafana)
├─ Backups (automated daily)
└─ Load balancer (distribute traffic)
```

#### **Security Features**

```
1. AUTHENTICATION
   ├─ Phone OTP (SMS-based login)
   ├─ Email+Password registration
   ├─ JWT tokens (secure session management)
   └─ Token refresh mechanism

2. AUTHORIZATION
   ├─ Role-based access (SHG, Admin, Official, etc.)
   ├─ Scope-based (District/ULB officials see only their area)
   └─ Ownership checks (can't edit someone else's product)

3. DATA PROTECTION
   ├─ HTTPS only (encrypted communication)
   ├─ Helmet security headers (XSS, clickjacking protection)
   ├─ Input validation (bad data rejected)
   ├─ Rate limiting (prevent bot attacks)
   ├─ PII encryption (personal data encrypted in database)
   └─ Virus scanning (images scanned before upload)

4. INFRASTRUCTURE
   ├─ Docker isolation (services can't interfere)
   ├─ Network security (internal communication only)
   ├─ Database encryption (data at rest)
   └─ Audit logging (track who did what)
```

#### **Key Files to Know**

| File                           | What It Does           | For What?                    |
| ------------------------------ | ---------------------- | ---------------------------- |
| `package.json` (root)          | Lists all npm packages | Installing dependencies      |
| `turbo.json`                   | Configure Turborepo    | How to build/test all apps   |
| `prisma/schema.prisma`         | Database design        | Understanding data structure |
| `apps/core-api/src/main.ts`    | Backend startup        | How backend starts           |
| `apps/web/src/App.tsx`         | Frontend root          | Main React component         |
| `apps/ml-services/app/main.py` | ML backend startup     | How ML services start        |
| `infra/docker-compose.yml`     | Local dev setup        | Starting all infrastructure  |
| `docs/adr/`                    | Architecture decisions | Why choices were made        |

#### **Common Tasks and Where to Find Them**

| Task                   | Where to Look                                       |
| ---------------------- | --------------------------------------------------- |
| Add new API endpoint   | `apps/core-api/src/{module}/{module}.controller.ts` |
| Change database schema | `database/prisma/schema.prisma`                     |
| Add new ML model       | `apps/ml-services/app/{module}/*.py`                |
| Create UI page         | `apps/web/src/pages/*.tsx`                          |
| Add npm package        | Update `package.json` in relevant workspace         |
| Change settings        | `.env` files or `apps/*/config/*`                   |
| Deploy to cloud        | `infra/terraform/` and `infra/k8s/`                 |
| Fix a bug              | Check `docs/runbooks/` for procedures               |

---

## Summary

**SHGAP is a comprehensive agricultural e-marketplace platform** with:

✅ **Frontend:** React PWA (phone-first, works offline)
✅ **Backend:** NestJS API with auth, registry, and orchestration
✅ **Intelligence:** Python ML models for matching, forecasting, and categorization
✅ **Infrastructure:** PostgreSQL, Redis, MinIO, containerized microservices
✅ **Scale:** Designed for Kubernetes and AWS deployment
✅ **Security:** JWT, encryption, rate limiting, audit logging

The system brings **AI-powered buyer recommendations** to small farmers, helping them connect with the right customers at the right price, right time — transforming how agricultural SHGs do business in Andhra Pradesh.

---

**Next Steps for New Developers:**

1. Read [`docs/adr/0001-0012`](docs/adr/) for architectural decisions
2. Set up local development: `npm install` + `docker compose up`
3. Explore API docs at `http://localhost:3000/api/docs`
4. Read `apps/*/README.md` for module-specific details
5. Check `docs/runbooks/` for operational procedures
6. Refer back to this document for architecture questions
