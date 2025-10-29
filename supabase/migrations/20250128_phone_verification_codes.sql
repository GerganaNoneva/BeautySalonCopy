-- Таблица за временно съхранение на SMS кодове за верификация
CREATE TABLE IF NOT EXISTS phone_verification_codes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  phone TEXT NOT NULL,
  code TEXT NOT NULL,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  expires_at TIMESTAMPTZ NOT NULL DEFAULT NOW() + INTERVAL '15 minutes',
  verified BOOLEAN NOT NULL DEFAULT FALSE,
  attempts INT NOT NULL DEFAULT 0,

  CONSTRAINT check_code_length CHECK (LENGTH(code) = 6)
);

-- Индекс за бързо търсене по телефон
CREATE INDEX IF NOT EXISTS idx_phone_verification_codes_phone
  ON phone_verification_codes(phone);

-- Индекс за бързо търсене по user_id
CREATE INDEX IF NOT EXISTS idx_phone_verification_codes_user_id
  ON phone_verification_codes(user_id);

-- Автоматично изтриване на изтекли кодове (cleanup)
CREATE OR REPLACE FUNCTION cleanup_expired_verification_codes()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  DELETE FROM phone_verification_codes
  WHERE expires_at < NOW() OR verified = TRUE;
END;
$$;

-- RLS политики
ALTER TABLE phone_verification_codes ENABLE ROW LEVEL SECURITY;

-- Потребителите могат да четат само своите кодове
CREATE POLICY "Users can read their own verification codes"
  ON phone_verification_codes
  FOR SELECT
  USING (auth.uid() = user_id);

-- Всеки може да създава кодове (за нови регистрации)
CREATE POLICY "Anyone can create verification codes"
  ON phone_verification_codes
  FOR INSERT
  WITH CHECK (true);

-- Потребителите могат да обновяват само своите кодове
CREATE POLICY "Users can update their own verification codes"
  ON phone_verification_codes
  FOR UPDATE
  USING (auth.uid() = user_id);

-- Коментари
COMMENT ON TABLE phone_verification_codes IS 'Временно съхранение на SMS кодове за телефонна верификация';
COMMENT ON COLUMN phone_verification_codes.phone IS 'Телефонен номер за верификация';
COMMENT ON COLUMN phone_verification_codes.code IS '6-цифрен код за потвърждение';
COMMENT ON COLUMN phone_verification_codes.expires_at IS 'Валидност на кода - 15 минути';
COMMENT ON COLUMN phone_verification_codes.attempts IS 'Брой опити за верификация (макс 3)';
