import { NextResponse } from 'next/server';

interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
}

// Built-in verified nutritional database for instant offline calculation
const NUTRITION_BENCHMARKS: Record<
  string,
  { name: string; serving: string; calories: number; protein: number; carbs: number; fat: number; fibre: number; tips: string }
> = {
  egg: {
    name: 'Whole Egg',
    serving: '1 large egg (~50g)',
    calories: 72,
    protein: 6.3,
    carbs: 0.4,
    fat: 4.8,
    fibre: 0,
    tips: 'Packed with complete high-quality protein, choline, and essential vitamins.',
  },
  'egg white': {
    name: 'Egg White',
    serving: '1 egg white (~33g)',
    calories: 17,
    protein: 3.6,
    carbs: 0.2,
    fat: 0.1,
    fibre: 0,
    tips: 'Pure lean protein with almost zero fat and carbohydrates.',
  },
  chicken: {
    name: 'Chicken Breast (Grilled/Cooked)',
    serving: '100g cooked',
    calories: 165,
    protein: 31.0,
    carbs: 0,
    fat: 3.6,
    fibre: 0,
    tips: 'One of the leanest protein sources available, great for muscle recovery and fat loss.',
  },
  rice: {
    name: 'Cooked White Basmati Rice',
    serving: '1 cup (~158g)',
    calories: 205,
    protein: 4.2,
    carbs: 44.5,
    fat: 0.5,
    fibre: 0.6,
    tips: 'Clean complex carbohydrate that fuels daily energy and athletic workouts.',
  },
  roti: {
    name: 'Roti / Chapati (Whole Wheat)',
    serving: '1 medium roti (~40g)',
    calories: 104,
    protein: 3.2,
    carbs: 18.0,
    fat: 1.4,
    fibre: 2.6,
    tips: 'High in dietary fibre and complex carbs for sustained fullness and digestive health.',
  },
  chapati: {
    name: 'Roti / Chapati (Whole Wheat)',
    serving: '1 medium roti (~40g)',
    calories: 104,
    protein: 3.2,
    carbs: 18.0,
    fat: 1.4,
    fibre: 2.6,
    tips: 'High in dietary fibre and complex carbs for sustained fullness.',
  },
  dal: {
    name: 'Dal (Yellow Lentils / Moong Dal Cooked)',
    serving: '1 cup (~200g)',
    calories: 198,
    protein: 12.0,
    carbs: 30.0,
    fat: 1.2,
    fibre: 8.0,
    tips: 'Excellent vegetarian protein packed with soluble gut-friendly fibre.',
  },
  paneer: {
    name: 'Paneer (Cottage Cheese)',
    serving: '100g',
    calories: 265,
    protein: 18.3,
    carbs: 3.4,
    fat: 20.8,
    fibre: 0,
    tips: 'Rich in casein protein and calcium. For fat loss, portion control is key due to healthy fats.',
  },
  tofu: {
    name: 'Firm Tofu',
    serving: '100g',
    calories: 76,
    protein: 8.1,
    carbs: 1.9,
    fat: 4.8,
    fibre: 0.3,
    tips: 'Great plant-based protein alternative that is naturally low in calories and saturated fat.',
  },
  dosa: {
    name: 'Plain Dosa',
    serving: '1 medium dosa (~80g)',
    calories: 135,
    protein: 3.2,
    carbs: 23.2,
    fat: 3.0,
    fibre: 1.0,
    tips: 'Fermented carbohydrate source that is easy on digestion. Pair with sambar for extra protein.',
  },
  idli: {
    name: 'Steamed Idli',
    serving: '1 piece (~50g)',
    calories: 70,
    protein: 2.3,
    carbs: 14.0,
    fat: 0.4,
    fibre: 0.8,
    tips: 'Steamed, oil-free, fermented staple. 2-3 idlis with sambar makes a balanced breakfast.',
  },
  oats: {
    name: 'Rolled Oats (Raw)',
    serving: '50g (~half cup)',
    calories: 195,
    protein: 6.8,
    carbs: 33.0,
    fat: 3.5,
    fibre: 5.3,
    tips: 'Rich in beta-glucan soluble fibre that lowers LDL cholesterol and sustains satiety.',
  },
  banana: {
    name: 'Banana',
    serving: '1 medium banana (~118g)',
    calories: 105,
    protein: 1.3,
    carbs: 27.0,
    fat: 0.3,
    fibre: 3.1,
    tips: 'Great pre-workout energy booster full of potassium and fast-acting carbs.',
  },
  whey: {
    name: 'Whey Protein Powder',
    serving: '1 scoop (~33g)',
    calories: 128,
    protein: 25.0,
    carbs: 2.0,
    fat: 1.5,
    fibre: 0.3,
    tips: 'Fast-digesting complete protein with high BCAA content for optimal muscle synthesis.',
  },
  panipuri: {
    name: 'Pani Puri / Golgappa',
    serving: '1 plate (6 pieces with spiced water & potato filling)',
    calories: 190,
    protein: 2.5,
    carbs: 34.0,
    fat: 5.5,
    fibre: 1.8,
    tips: 'Fried discretionary food. High in sodium and simple carbs. Limit portions and skip sweet syrup.',
  },
  samosa: {
    name: 'Samosa (Fried Potato)',
    serving: '1 piece (~90g)',
    calories: 260,
    protein: 3.5,
    carbs: 32.0,
    fat: 14.0,
    fibre: 2.1,
    tips: 'Deep-fried discretionary snack. High in saturated fats and refined carbs. Enjoy sparingly.',
  },
  pizza: {
    name: 'Cheese Pizza Slice',
    serving: '1 regular slice (~100g)',
    calories: 266,
    protein: 11.0,
    carbs: 33.0,
    fat: 10.0,
    fibre: 2.3,
    tips: 'High calorie density. Pair a single slice with a green salad to manage hunger and glucose spikes.',
  },
  burger: {
    name: 'Cheeseburger',
    serving: '1 burger (~150g)',
    calories: 380,
    protein: 18.0,
    carbs: 35.0,
    fat: 19.0,
    fibre: 1.5,
    tips: 'Higher discretionary meal. Skip extra mayo or bacon to shave off 100+ surplus calories.',
  },
  biryani: {
    name: 'Chicken Biryani',
    serving: '1 plate / box (~350g)',
    calories: 520,
    protein: 26.0,
    carbs: 65.0,
    fat: 18.0,
    fibre: 3.0,
    tips: 'Substantial meal with good protein. Watch out for excess ghee or fried onions if in a calorie deficit.',
  },
};

function generateBuiltInResponse(message: string): string {
  const lower = message.toLowerCase().trim();

  // 1. Street Food / Junk Food Queries (Panipuri, Samosa, Pizza, Burger, Junk)
  if (lower.includes('panipuri') || lower.includes('pani puri') || lower.includes('golgappa') || lower.includes('puchka')) {
    return `### 🥘 Can You Eat Pani Puri / Golgappa?
**Verdict:** You can enjoy it in moderation, but it's a **discretionary treat**, not everyday fuel! 😋

* **Nutritional Benchmark (6 puris):**
  * **Calories:** ~180 – 220 kcal
  * **Protein:** ~2.5g *(very low)*
  * **Carbs:** ~34g *(mostly fried refined flour & potato)*
  * **Fat:** ~5.5g
  * **Sodium:** High *(from spicy flavoured water)*

💡 **Coach's Advice for Today:**
1. **Stick to 4–6 pieces** rather than eating multiple rounds.
2. **Opt for spicy water (Teekha pani)** and skip or minimize the sweet tamarind chutney, which contains concentrated sugar syrup.
3. **Balance your day:** Ensure your lunch and dinner are rich in protein (*dal, boiled eggs, paneer, or chicken*) to hit your daily macro targets!`;
  }

  if (lower.includes('samosa')) {
    return `### 🥟 Samosa Breakdown & Health Advice
* **1 Medium Samosa:** ~260 kcal | 3.5g Protein | 32g Carbs | 14g Fat
* **The Reality:** Because samosas are deep-fried in oil, over **50% of the calories** come from cooking fats.
* **Smart Tip:** If you're craving one, have half or one piece with a cup of green tea or black coffee, avoid fried snacks for the rest of the day, and drink extra water!`;
  }

  // 2. Specific Quantity Food Calculation (e.g. "2 eggs", "3 rotis", "1 cup rice")
  const eggMatch = lower.match(/(\d+)\s*(whole\s*)?egg/);
  if (eggMatch) {
    const qty = parseInt(eggMatch[1], 10) || 1;
    const item = NUTRITION_BENCHMARKS['egg'];
    const totalCal = item.calories * qty;
    const totalProtein = (item.protein * qty).toFixed(1);
    const totalCarbs = (item.carbs * qty).toFixed(1);
    const totalFat = (item.fat * qty).toFixed(1);

    return `### 🥚 Nutritional Value for ${qty} Whole Egg${qty > 1 ? 's' : ''}:
* 🔥 **Calories:** **${totalCal} kcal**
* 💪 **Protein:** **${totalProtein}g** *(High Biological Value)*
* 🌾 **Carbohydrates:** **${totalCarbs}g**
* 🥑 **Fats:** **${totalFat}g** *(Healthy unsaturated & omega fats)*

✨ **Why this is great:** Eggs provide all 9 essential amino acids plus vitamin B12, choline, and lutein. Would you like to log this into your **NutriTrack Breakfast** or **Snack journal**?`;
  }

  const rotiMatch = lower.match(/(\d+)\s*(roti|chapati|chapatis|rotis)/);
  if (rotiMatch) {
    const qty = parseInt(rotiMatch[1], 10) || 1;
    const item = NUTRITION_BENCHMARKS['roti'];
    const totalCal = item.calories * qty;
    const totalProtein = (item.protein * qty).toFixed(1);
    const totalCarbs = (item.carbs * qty).toFixed(1);
    const totalFat = (item.fat * qty).toFixed(1);
    const totalFibre = (item.fibre * qty).toFixed(1);

    return `### 🫓 Nutritional Value for ${qty} Roti / Chapati${qty > 1 ? 's' : ''} (Medium Whole Wheat):
* 🔥 **Calories:** **${totalCal} kcal**
* 💪 **Protein:** **${totalProtein}g**
* 🌾 **Carbohydrates:** **${totalCarbs}g**
* 🥗 **Dietary Fibre:** **${totalFibre}g**
* 🥑 **Fats:** **${totalFat}g** *(without extra ghee/butter)*

💡 **Pairing Tip:** Pair your rotis with a high-protein bowl of **dal, paneer, or chicken breast** and steamed vegetables for a perfectly balanced meal!`;
  }

  const chickenMatch = lower.match(/(\d+)\s*g(rams?)?\s*(of\s*)?chicken/);
  if (chickenMatch) {
    const grams = parseInt(chickenMatch[1], 10) || 100;
    const multiplier = grams / 100;
    const totalCal = Math.round(165 * multiplier);
    const totalProtein = (31 * multiplier).toFixed(1);
    const totalFat = (3.6 * multiplier).toFixed(1);

    return `### 🍗 Nutritional Value for ${grams}g Cooked Chicken Breast:
* 🔥 **Calories:** **${totalCal} kcal**
* 💪 **Protein:** **${totalProtein}g** *(Super lean!)*
* 🌾 **Carbohydrates:** **0g**
* 🥑 **Fats:** **${totalFat}g**

Chicken breast is the gold standard for high-protein muscle repair with low caloric density!`;
  }

  // 3. High Protein Vegetarian Foods
  if (lower.includes('protein') && (lower.includes('veg') || lower.includes('vegetarian'))) {
    return `### 🌱 Top High-Protein Vegetarian Foods:
1. **Paneer (Cottage Cheese):** ~18g protein per 100g
2. **Moong Dal / Chana / Lentils:** ~9–12g protein per cooked cup
3. **Firm Tofu / Soya Chunks:** ~15–20g protein per 100g
4. **Greek Yogurt / Curd:** ~10g protein per 170g cup
5. **Roasted Peanuts / Almonds:** ~25g protein per 100g *(energy dense)*
6. **Whey Protein:** ~24–27g protein per scoop

💡 **Tip:** Combine grains (rice or roti) with pulses (dal or chickpeas) to form a **complete amino acid profile**!`;
  }

  // 4. Weight Loss / Deficit Tips
  if (lower.includes('lose weight') || lower.includes('fat loss') || lower.includes('belly fat')) {
    return `### 🎯 Core Principles for Healthy Weight Loss:
1. **Moderate Caloric Deficit:** Aim for 300–500 calories below your TDEE (maintenance). Check your custom target on your **NutriTrack Dashboard**.
2. **Prioritize Protein (1.4–1.8g per kg body weight):** Preserves muscle while you shed body fat and keeps you satiated.
3. **Drink 2.5–3.5 Litres of Water:** Often hunger is just mild dehydration in disguise.
4. **Target 8,000–10,000 Steps Daily:** Non-exercise activity burns significant calories without spiking hunger.
5. **Log Everything Daily:** Consistency in your NutriTrack journal is the #1 predictor of long-term success!`;
  }

  // 5. Water / Hydration Queries
  if (lower.includes('water') || lower.includes('hydration') || lower.includes('drink')) {
    return `### 💧 Daily Water Intake Recommendation:
* **Ideal Daily Target:** **35 ml per kg of body weight** *(roughly 2.5 to 3.5 Litres daily)*.
* **Why it matters:** Proper hydration speeds up cellular metabolism, aids kidney digestion, and prevents false hunger pangs.
* **Quick Action:** Tap the **Water Tracker** in your NutriTrack app right now to log your latest glass! 🥤`;
  }

  // 6. Generic Nutritional Check for any matched food item
  for (const [key, item] of Object.entries(NUTRITION_BENCHMARKS)) {
    if (lower.includes(key)) {
      return `### 🥗 Nutrition Facts for ${item.name}
* **Portion:** ${item.serving}
* 🔥 **Calories:** ${item.calories} kcal
* 💪 **Protein:** ${item.protein}g
* 🌾 **Carbohydrates:** ${item.carbs}g
* 🥑 **Fat:** ${item.fat}g
* 🥗 **Fibre:** ${item.fibre}g

💡 **Coach's Insight:** ${item.tips}
Would you like help logging this into your daily meal journal?`;
    }
  }

  // Default helpful response
  return `### 🤖 NutriTrack AI Nutrition Assistant
I'm here to help you hit your nutrition, weight, and fitness goals!

**You can ask me things like:**
* *"I ate 2 eggs and 2 rotis, how many calories and protein did I get?"*
* *"Is it okay to eat panipuri, pizza, or samosa today?"*
* *"What are the best high-protein vegetarian snacks?"*
* *"How much water should I drink every day?"*
* *"How can I stay within my daily calorie budget?"*

Feel free to ask any question about your diet, meals, or fitness! 🥗💪`;
}

export async function POST(request: Request) {
  try {
    const body = await request.json().catch(() => ({}));
    const { message = '', history = [] } = body;

    if (!message || typeof message !== 'string' || !message.trim()) {
      return NextResponse.json(
        { error: 'Message is required.' },
        { status: 400 }
      );
    }

    const trimmedMessage = message.trim();

    // 1. Check if GEMINI_API_KEY is configured for real live LLM generation
    const geminiKey = process.env.GEMINI_API_KEY;
    if (geminiKey) {
      try {
        const systemPrompt = `You are NutriTrack AI, a helpful, enthusiastic, and scientifically-grounded Nutrition & Fitness Assistant for the NutriTrack application.
- Answer user questions about food nutrition, calories, macros (protein, carbs, fat, fibre), healthy alternatives, and fitness tips.
- When the user asks about specific portions (e.g. "I ate 2 eggs", "How many calories in 1 cup of rice"), calculate the exact nutritional breakdown clearly using bullet points.
- When the user asks about street foods, junk food, or snacks (e.g. panipuri, samosas, pizza, burgers, sweets), be realistic and non-judgmental. Explain their calorie and sodium density, advise on portion control (e.g. "limit to 4-6 pieces, skip sugary syrup"), and suggest how to balance the rest of the day with high-protein whole foods.
- Format your response with clear markdown headings, bold numbers, bullet points, and relevant emojis.
- Include a friendly motivational closing or practical action step.`;

        const contents = [
          {
            role: 'user',
            parts: [{ text: `${systemPrompt}\n\nUser Question: ${trimmedMessage}` }],
          },
        ];

        const geminiRes = await fetch(
          `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${geminiKey}`,
          {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              contents,
              generationConfig: {
                temperature: 0.4,
                maxOutputTokens: 600,
              },
            }),
          }
        );

        if (geminiRes.ok) {
          const geminiData = await geminiRes.json();
          const reply = geminiData.candidates?.[0]?.content?.parts?.[0]?.text;
          if (reply && reply.trim()) {
            return NextResponse.json({
              reply: reply.trim(),
              source: 'gemini-ai',
            });
          }
        }
      } catch (geminiErr) {
        console.warn('Gemini AI call failed, falling back to built-in knowledge engine:', geminiErr);
      }
    }

    // 2. Built-in Nutrition Engine Fallback (fast, offline-ready, accurate)
    const reply = generateBuiltInResponse(trimmedMessage);
    return NextResponse.json({
      reply,
      source: 'built-in-nutrition-engine',
    });
  } catch (error) {
    console.error('Error in AI chat route:', error);
    return NextResponse.json(
      { error: 'Failed to process AI chat message' },
      { status: 500 }
    );
  }
}
