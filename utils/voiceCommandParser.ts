// Типове за гласови команди
export type VoiceCommandType =
  | 'show_next_free_slot'          // Покажи следващия свободен час
  | 'show_next_n_free_slots'       // Покажи следващите N свободни часа
  | 'show_schedule_for_date'       // Покажи график за дата
  | 'show_schedule_for_day'        // Покажи график за ден (понеделник, вторник...)
  | 'create_reservation'           // Създай резервация с пълни детайли
  | 'client_info'                  // Информация за клиент (кога има час)
  | 'open_chat'                    // Отвори чат с клиент
  | 'call_client'                  // Позвъни на клиент
  | 'unknown';                     // Неразпозната команда

export interface ParsedVoiceCommand {
  type: VoiceCommandType;
  confidence: number;
  data?: {
    // За дати
    date?: string;              // ISO формат: 2025-10-20
    dayOfWeek?: string;         // 'понеделник', 'вторник', etc.

    // За часове
    startTime?: string;         // HH:mm формат: "14:30"
    endTime?: string;           // HH:mm формат: "15:00"

    // За клиенти
    clientName?: string;        // Име на клиент

    // За услуги
    serviceName?: string;       // Вид услуга

    // За количество
    count?: number;             // Брой свободни часове

    // За нови клиенти
    isNewClient?: boolean;      // Дали клиентът не съществува
  };
  rawText: string;              // Оригиналния текст от разпознаването
}

// Функция за парсиране на гласова команда с OpenAI
export async function parseVoiceCommand(
  transcript: string,
  openAiApiKey: string
): Promise<ParsedVoiceCommand> {
  const today = new Date();
  const todayStr = today.toLocaleDateString('bg-BG', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric'
  });

  const systemPrompt = `Ти си асистент за разпознаване на гласови команди в салон за красота.
Днешната дата е: ${todayStr}

Разпознай командата и върни JSON обект със следната структура:
{
  "type": "<тип на командата>",
  "confidence": <число от 0 до 1>,
  "data": {
    // данни специфични за командата
  }
}

Типове команди:
1. "show_next_free_slot" - показва следващия свободен час
   Примери: "Покажи следващия свободен час", "Кажи ми следващия свободен час"

2. "show_next_n_free_slots" - показва следващите N свободни часа
   Примери: "Покажи следващите 5 свободни часа", "Кажи ми следващите 3 свободни часа"
   data: { count: <число> }

3. "show_schedule_for_date" - показва график за конкретна дата
   Примери: "Покажи ми графика за 25 октомври", "Отвори графика за утре"
   data: { date: "YYYY-MM-DD" }

4. "show_schedule_for_day" - показва график за ден от седмицата (следващия такъв)
   Примери: "Покажи ми графика за вторник", "Отвори графика за петък"
   data: { dayOfWeek: "понеделник|вторник|сряда|четвъртък|петък|събота|неделя" }

5. "create_reservation" - създава резервация
   Примери: "Създай резервация за утре от 14 до 15 часа за маникюр на Мария Иванова"
   data: { date: "YYYY-MM-DD", startTime: "HH:mm", endTime: "HH:mm", serviceName: "string", clientName: "string" }

6. "client_info" - информация за клиент
   Примери: "Кога Мария има час", "Кога Иван има резервация"
   data: { clientName: "string" }

7. "open_chat" - отваря чат с клиент
   Примери: "Отвори чата с Мария", "Прати съобщение на Иван"
   data: { clientName: "string" }

8. "call_client" - звъни на клиент
   Примери: "Позвъни на Мария", "Набери Иван"
   data: { clientName: "string" }

ВАЖНО:
- Когато парсираш дати, използвай ISO формат (YYYY-MM-DD)
- "утре" = следващия ден, "днес" = днешния ден, "вчера" = предишния ден
- Дни от седмицата винаги се отнасят за СЛЕДВАЩИЯ такъв ден (ако днес е понеделник и кажат "вторник", значи утре)
- За времена използвай 24-часов формат (HH:mm)
- Извличай ПЪЛНИТЕ имена на клиенти (име и фамилия ако има)
- confidence трябва да е високо (>0.8) само ако си сигурен в разпознаването

Върни САМО валиден JSON, без коментари или допълнителен текст.`;

  try {
    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${openAiApiKey}`,
      },
      body: JSON.stringify({
        model: 'gpt-4o-mini',
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: transcript },
        ],
        temperature: 0.3,
        max_tokens: 500,
      }),
    });

    if (!response.ok) {
      console.error('OpenAI API error:', response.status, await response.text());
      return {
        type: 'unknown',
        confidence: 0,
        rawText: transcript,
      };
    }

    const result = await response.json();
    const content = result.choices[0]?.message?.content;

    if (!content) {
      return {
        type: 'unknown',
        confidence: 0,
        rawText: transcript,
      };
    }

    // Парсираме JSON отговора от OpenAI
    const parsed = JSON.parse(content);

    return {
      type: parsed.type || 'unknown',
      confidence: parsed.confidence || 0,
      data: parsed.data || {},
      rawText: transcript,
    };
  } catch (error) {
    console.error('Error parsing voice command:', error);
    return {
      type: 'unknown',
      confidence: 0,
      rawText: transcript,
    };
  }
}

// Помощна функция за форматиране на дата от текст
export function parseDateFromText(text: string, referenceDate: Date = new Date()): Date | null {
  const lowerText = text.toLowerCase();

  // Днес
  if (lowerText.includes('днес')) {
    return referenceDate;
  }

  // Утре
  if (lowerText.includes('утре')) {
    const tomorrow = new Date(referenceDate);
    tomorrow.setDate(tomorrow.getDate() + 1);
    return tomorrow;
  }

  // Вчера
  if (lowerText.includes('вчера')) {
    const yesterday = new Date(referenceDate);
    yesterday.setDate(yesterday.getDate() - 1);
    return yesterday;
  }

  // Дни от седмицата
  const dayNames: { [key: string]: number } = {
    'понеделник': 1,
    'вторник': 2,
    'сряда': 3,
    'четвъртък': 4,
    'петък': 5,
    'събота': 6,
    'неделя': 0,
  };

  for (const [dayName, targetDay] of Object.entries(dayNames)) {
    if (lowerText.includes(dayName)) {
      const result = new Date(referenceDate);
      const currentDay = result.getDay();
      let daysToAdd = targetDay - currentDay;

      // Ако денят е същия или е минал, добавяме 7 дни
      if (daysToAdd <= 0) {
        daysToAdd += 7;
      }

      result.setDate(result.getDate() + daysToAdd);
      return result;
    }
  }

  return null;
}
