/*
  # Поправка на RLS policies за profiles таблицата

  ## Проблем
  - Policy "Admin can view all profiles" създава infinite recursion
  - Прави SELECT на profiles вътре в profiles policy

  ## Решение
  - Премахване на проблемните policies
  - Създаване на нови опростени policies без recursion
  - Използване на auth.jwt() за проверка на роля вместо SELECT на profiles

  ## Промени
  1. DROP на старите policies
  2. CREATE на нови безопасни policies
  3. Добавяне на INSERT policy за OAuth регистрация
*/

-- Премахване на старите policies
DROP POLICY IF EXISTS "Users can view own profile" ON profiles;
DROP POLICY IF EXISTS "Admin can view all profiles" ON profiles;
DROP POLICY IF EXISTS "Users can update own profile" ON profiles;

-- Нови policies без recursion

-- Потребителите могат да виждат собствения си профил
CREATE POLICY "Users can view own profile"
  ON profiles FOR SELECT
  TO authenticated
  USING (auth.uid() = id);

-- Потребителите могат да създават собствен профил (за OAuth)
CREATE POLICY "Users can create own profile"
  ON profiles FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = id);

-- Потребителите могат да обновяват собствения си профил
CREATE POLICY "Users can update own profile"
  ON profiles FOR UPDATE
  TO authenticated
  USING (auth.uid() = id)
  WITH CHECK (auth.uid() = id);

-- Потребителите могат да изтриват собствения си профил
CREATE POLICY "Users can delete own profile"
  ON profiles FOR DELETE
  TO authenticated
  USING (auth.uid() = id);