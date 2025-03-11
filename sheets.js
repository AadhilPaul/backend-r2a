require("dotenv").config()
const { google } = require("googleapis");
const path = require("path");
const axios = require("axios");

// Load service account credentials
const auth = new google.auth.GoogleAuth({
  credentials: JSON.parse(process.env.SERVICE_ACCOUNT_JSON), // ✅ Load from env variable
  scopes: ["https://www.googleapis.com/auth/spreadsheets"],
});

const sheets = google.sheets({ version: "v4", auth });

const SPREADSHEET_ID = "1Q-JnljuVh1Yz6CMUH9lL9vL3Gk3AsFPmuaFGbobNk90";

async function getQuizQuestions() {
  try {
    const res = await sheets.spreadsheets.values.get({
      spreadsheetId: SPREADSHEET_ID,
      range: "questions_db!A:J",
    });


    const rows = res.data.values;
    if (!rows || rows.length === 0) return [];

    return rows
      .slice(1)
      .map(
        ([
          Q_ID,
          Question,
          OptionA,
          OptionB,
          OptionC,
          OptionD,
          Correct,
          Level,
          isCode,
          Code
        ]) => ({
          id: Q_ID,
          question: Question,
          options: { A: OptionA, B: OptionB, C: OptionC, D: OptionD },
          correct: Correct,
          level: Level || "Unknown",
          isCode: isCode,
          code: Code,
        })
      );
  } catch (error) {
    console.error("Error fetching quiz questions:", error);
    return [];
  }
}

const API_URL = "http://localhost:3000/api"; // Backend URL

async function submitFinalScore(username, score) {
  try {
    await axios.post(`${API_URL}/submit-final-score`, { username, score });
    console.log(`✅ Final score submitted: ${username} - ${score}`);
  } catch (error) {
    console.error("❌ Error submitting final score:", error);
  }
}

async function getFinalScore(username) {
  try {
    const res = await sheets.spreadsheets.values.get({
      spreadsheetId: SPREADSHEET_ID,
      range: "responses_db!A:Z",
    });

    const rows = res.data.values || [];
    const userRow = rows.find((row) => row[0] === username);

    if (!userRow) return null;

    return { username, score: userRow[1] }; // Score is in column 1
  } catch (error) {
    console.error("Error fetching final score:", error);
    return null;
  }
}


async function submitResponse(username, qId, selectedAnswer) {
  try {
    // Fetch existing responses
    const res = await sheets.spreadsheets.values.get({
      spreadsheetId: SPREADSHEET_ID,
      range: "responses_db!A:Z", // Fetch all data
    });

    let rows = res.data.values || [];
    let headers = rows[0] || ["USERNAME", "TOTAL SCORE"]; // Default headers

    // Find user's row
    let userRow = rows.findIndex((row) => row[0] === username);
    if (userRow === -1) {
      // New user, create row
      userRow = rows.length;
      rows.push([username, "0"]); // Default 0 score
    }

    // Find the column for the question (starting from index 2)
    let questionCol = headers.indexOf(qId);
    if (questionCol === -1) {
      // New question, add column at the end
      questionCol = headers.length;
      headers.push(qId);
      rows[0] = headers; // Update headers
      rows.forEach((row) => (row.length = headers.length)); // Ensure all rows match length
    }

    // Fetch correct answer from questions_db
    const questionsRes = await sheets.spreadsheets.values.get({
      spreadsheetId: SPREADSHEET_ID,
      range: "questions_db!A:J",
    });

    const questionRows = questionsRes.data.values || [];
    const question = questionRows.find((row) => row[0] === qId); // Find question by Q_ID
    const correctAnswer = question ? question[6] : null; // Correct answer in column G

    const questionLevels = {};
    questionRows.forEach((row) => {
      if (row[0] && row[7]) {
        questionLevels[row[0]] = parseInt(row[7]) || 1;
      }
    });
    console.log("Question Levels Map:", questionLevels);

    // Function to get points based on level
    function getPoints(level) {
      switch (level) {
        case 1:
          return { positive: 4, negative: 0 };
        case 2:
          return { positive: 6, negative: 2 };
        case 3:
          return { positive: 10, negative: 3 };
        default:
          return { positive: 0, negative: 0 };
      }
    }

    // Determine correctness
    const isCorrect = correctAnswer && correctAnswer === selectedAnswer;
    rows[userRow][questionCol] = isCorrect ? "✅" : "❌";

    // Recalculate total score (column index 1)
    let score = 0;
    for (let i = 2; i < headers.length; i++) {
      const questionId = headers[i]; // Question ID from the headers
      const level = questionLevels[questionId] || 1; // Default level 1 if missing
      const { positive, negative } = getPoints(level);
      if (rows[userRow][i] === "✅") score += positive;
      else if (rows[userRow][i] === "❌") score -= negative;
    }
    rows[userRow][1] = score.toString(); // Update total score in column 1

    // ✅ Call submitFinalScore when last question is answered
    if (headers.length - 2 === questionRows.length) {
      // Check if all questions are answered
    await submitFinalScore(username, score);
    }

    // Update sheet
    await sheets.spreadsheets.values.update({
      spreadsheetId: SPREADSHEET_ID,
      range: "responses_db!A1",
      valueInputOption: "USER_ENTERED",
      requestBody: { values: rows },
    });

    console.log("Response submitted successfully!");
  } catch (error) {
    console.error("Error submitting response:", error);
  }
}

// Export functions for use in server.js
module.exports = { getQuizQuestions, submitResponse, getFinalScore };
