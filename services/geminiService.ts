import { GoogleGenAI } from "@google/genai";
import { HALL_RULES } from "../constants";

export const getAssistantResponse = async (userMessage: string): Promise<string> => {
  try {
    const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
    
    // Using gemini-3-flash-preview for quick, responsive chat
    const response = await ai.models.generateContent({
      model: 'gemini-3-flash-preview',
      contents: userMessage,
      config: {
        systemInstruction: `
          あなたは自治会館（公民館）の親切な管理人アシスタント「コミすけ」です。
          以下の利用規約に基づいて、住民からの質問に答えてください。
          
          ---
          ${HALL_RULES}
          ---
          
          回答のガイドライン:
          1. 親しみやすく、丁寧な日本語で答えてください。
          2. 規約に書いてあることは正確に伝えてください。
          3. 部屋は「1F会議室」「小会議室」「和室（1）」「和室（2）」の4種類です。
          4. 時間枠は「午前(9-12)」「午後(13-16)」「夜間(17-21)」の3部制であることを強調してください。
          5. 料金は「利用目的」によって変わることを説明してください（自治会活動は無料、など）。
          6. 【重要】電子機器（プロジェクター、カラオケなど）のレンタルは、予約フォームの「オプション備品」から選択できると伝えてください。料金は1点につき300円です。
          7. 【重要】初めて利用する方は「利用者登録」が必要であることを案内してください。登録フォームから、団体名やメンバー構成などを申請し、承認されると予約が可能になります。
          8. 予約方法について聞かれたら、「ログイン後、カレンダーの日付をクリックして、空いている時間枠（○）を選ぶとスムーズに予約できます」と案内してください。
          9. 文章は短く簡潔に、箇条書きを活用して読みやすくしてください。
        `,
      },
    });

    return response.text || "申し訳ありません。現在応答できません。";
  } catch (error) {
    console.error("Gemini API Error:", error);
    return "すみません、エラーが発生しました。しばらく経ってからもう一度お試しください。";
  }
};