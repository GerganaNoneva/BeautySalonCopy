import "jsr:@supabase/functions-js/edge-runtime.d.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

const reservationSchema = {
  type: "object",
  properties: {
    customerName: { type: "string", description: "Име на клиента" },
    phone: { type: "string", description: "Телефонен номер (празен string ако липсва)" },
    service: { type: "string", description: "Название на услугата" },
    date: { type: "string", pattern: "^\\d{4}-\\d{2}-\\d{2}$", description: "Дата във формат YYYY-MM-DD" },
    startTime: { type: "string", pattern: "^\\d{2}:\\d{2}$", description: "Начален час във формат HH:MM" },
    endTime: { type: "string", pattern: "^\\d{2}:\\d{2}$", description: "Краен час във формат HH:MM" },
    notes: { type: "string", description: "Допълнителни бележки (празен string ако липсват)" },
  },
  required: ["customerName", "phone", "service", "date", "startTime", "endTime", "notes"],
  additionalProperties: false,
};

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, {
      status: 200,
      headers: corsHeaders,
    });
  }

  try {
    const { text } = await req.json();

    if (!text || typeof text !== 'string') {
      return new Response(
        JSON.stringify({ error: 'No text provided' }),
        {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    }

    const openaiApiKey = Deno.env.get('OPENAI_API_KEY');
    if (!openaiApiKey) {
      return new Response(
        JSON.stringify({ error: 'OpenAI API key not configured' }),
        {
          status: 500,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    }

    const today = new Date();
    today.setHours(today.getHours() + 2);
    const todayStr = today.toISOString().split('T')[0];
    const currentTime = today.toTimeString().slice(0, 5);

    const systemPrompt = `Ти си асистент за резервации в салон за красота. Извлечи информация за резервация от българския текст.

Важно:
- Днес е ${todayStr} (${getDayName(today)}).
- Текущият час е ${currentTime}.
- Времевата зона е Europe/Sofia.
- Ако е споменат ден от седмицата (напр. "петък", "сряда"), намери следващата дата за този ден.
- Ако е казано "другата сряда" или "следващата сряда", добави още една седмица.
- Ако часовете са казани на разговорен език ("три и половина" = 15:30, "пет" = 17:00), преобразувай ги.
- Ако е казано само начален час, използвай стандартна продължителност от 1 час.
- Ако липсва дата, използвай ${todayStr}.
- Ако има неяснота, попълни с най-вероятната стойност.
- Ако липсва телефон, използвай празен string "".
- Ако липсват бележки, използвай празен string "".

Примери:
- "Петък от три и половина до пет, гел лак, за Мария Иванова" → date: следващия петък, startTime: "15:30", endTime: "17:00", service: "Гел лак", customerName: "Мария Иванова", phone: "", notes: ""
- "Утре в 10, маникюр за Иванка" → date: утрешната дата, startTime: "10:00", endTime: "11:00", service: "Маникюр", customerName: "Иванка", phone: "", notes: ""
- "Следващата сряда от 14 часа, педикюр за Мария, тел 0888123456" → date: следващата сряда (не тази), startTime: "14:00", endTime: "15:00", service: "Педикюр", customerName: "Мария", phone: "0888123456", notes: ""`;

    console.log('Parsing text:', text);
    console.log('Today:', todayStr, getDayName(today));

    const openaiResponse = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${openaiApiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'gpt-4o-mini',
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: text },
        ],
        response_format: {
          type: 'json_schema',
          json_schema: {
            name: 'reservation',
            strict: true,
            schema: reservationSchema,
          },
        },
        temperature: 0.1,
      }),
    });

    if (!openaiResponse.ok) {
      const errorText = await openaiResponse.text();
      console.error('OpenAI API error:', errorText);

      let errorDetails;
      try {
        errorDetails = JSON.parse(errorText);
      } catch {
        errorDetails = { message: errorText };
      }

      return new Response(
        JSON.stringify({
          error: 'Parsing failed',
          details: errorDetails.error?.message || errorDetails.message || errorText,
          status: openaiResponse.status
        }),
        {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    }

    const completionData = await openaiResponse.json();
    const parsedReservation = JSON.parse(completionData.choices[0].message.content);

    return new Response(
      JSON.stringify(parsedReservation),
      {
        headers: {
          ...corsHeaders,
          'Content-Type': 'application/json',
        },
      }
    );
  } catch (error) {
    console.error('Error in parse-reservation function:', error);
    return new Response(
      JSON.stringify({ error: error.message || 'Internal server error' }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  }
});

function getDayName(date: Date): string {
  const days = ['Неделя', 'Понеделник', 'Вторник', 'Сряда', 'Четвъртък', 'Петък', 'Събота'];
  return days[date.getDay()];
}