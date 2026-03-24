-- 1. 사용자 / 인증 시스템
CREATE TABLE users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email VARCHAR(255) UNIQUE NOT NULL,
  password_hash VARCHAR(255) NOT NULL,
  name VARCHAR(100) NOT NULL,
  phone VARCHAR(20),
  role VARCHAR(50) DEFAULT 'doctor',
  status VARCHAR(50) DEFAULT 'active',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE TABLE doctor_profiles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  license_no VARCHAR(50) UNIQUE NOT NULL,
  specialty_id UUID,
  subspecialty VARCHAR(100),
  hospital_name VARCHAR(255),
  verification_status VARCHAR(50) DEFAULT 'pending',
  verified_at TIMESTAMP WITH TIME ZONE
);

-- 2. 채팅 코어
CREATE TABLE chat_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  title VARCHAR(255) NOT NULL,
  session_type VARCHAR(50) DEFAULT 'mixed',
  specialty_context_id UUID,
  started_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  last_message_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  archived_at TIMESTAMP WITH TIME ZONE
);

CREATE TABLE chat_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id UUID REFERENCES chat_sessions(id) ON DELETE CASCADE,
  role VARCHAR(50) NOT NULL,
  message_type VARCHAR(50) DEFAULT 'text',
  content TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 3. 의사 피드백 및 논문/블록
CREATE TABLE assistant_responses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  message_id UUID REFERENCES chat_messages(id) ON DELETE CASCADE,
  summary_text TEXT,
  safety_level VARCHAR(50) DEFAULT 'safe',
  response_json JSONB NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE TABLE doctor_feedback (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  response_id UUID REFERENCES assistant_responses(id) ON DELETE CASCADE,
  message_id UUID REFERENCES chat_messages(id) ON DELETE CASCADE,
  doctor_user_id UUID REFERENCES users(id),
  feedback_type VARCHAR(50) NOT NULL, -- 'like', 'dislike', 'neutral', 'opinion_only'
  opinion_text TEXT,
  tags_json JSONB,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 4. 약품 DB
CREATE TABLE drugs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  product_name VARCHAR(255) NOT NULL,
  ingredient_name VARCHAR(255),
  manufacturer_id UUID,
  dosage_form VARCHAR(100),
  strength VARCHAR(100),
  drug_type VARCHAR(50),
  reimbursement_status VARCHAR(50),
  insurance_price INTEGER,
  image_url TEXT,
  approval_status VARCHAR(50)
);

-- 5. 영상 DB
CREATE TABLE medical_images (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  uploader_user_id UUID REFERENCES users(id),
  session_id UUID REFERENCES chat_sessions(id),
  message_id UUID REFERENCES chat_messages(id),
  modality VARCHAR(50),
  body_part VARCHAR(100),
  file_path TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 6. 구인 구직
CREATE TABLE job_posts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  hospital_id UUID,
  title VARCHAR(255) NOT NULL,
  specialty_id UUID,
  region VARCHAR(100),
  employment_type VARCHAR(50),
  salary_range VARCHAR(100),
  description TEXT,
  is_paid BOOLEAN DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 이 파일은 Supabase SQL Editor에 복사-붙여넣기 하여 즉시 실행할 수 있습니다.
