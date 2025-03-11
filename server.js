const express = require("express");
const cors = require("cors");
const { getQuizQuestions, submitResponse, getFinalScore} = require("./sheets"); // Import functions

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors()); 

const finalScores = {};

// 🚀 API to Fetch Quiz Questions
app.get("/api/questions", async (req, res) => {
  try {
    const questions = await getQuizQuestions();
    res.json(questions);
  } catch (error) {
    console.error("Error fetching questions:", error);
    res.status(500).json({ error: "Failed to fetch questions" });
  }
});

app.post("/api/submit-final-score", async (req, res) => {
  try {
    const { username, score } = req.body;

    if (!username || score === undefined) {
      return res.status(400).json({ error: "Invalid request" });
    }

    finalScores[username] = score; // Store in-memory

    res.json({ message: "Final score saved!", username, score });
  } catch (error) {
    console.error("Error saving final score:", error);
    res.status(500).json({ error: "Failed to save final score" });
  }
});

app.get("/api/get-final-score/:username", async (req, res) => {
  try {
    const { username } = req.params;
    const scoreData = await getFinalScore(username);

    if (!scoreData) {
      return res.status(404).json({ error: "Final score not found" });
    }

    res.json(scoreData);
  } catch (error) {
    console.error("Error fetching final score:", error);
    res.status(500).json({ error: "Failed to fetch final score" });
  }
});



// 🚀 API to Submit User Responses
app.post("/api/submit", async (req, res) => {
  try {
    const { username, qId, selectedAnswer, isCorrect } = req.body;
    if (!username) {
      return res.status(404).json({error: "Username is required!"})
    }
    await submitResponse(username.trim(), qId, selectedAnswer, isCorrect);
    res.json({ message: "Response submitted successfully!" });
  } catch (error) {
    console.error("Error submitting response:", error);
    res.status(500).json({ error: "Failed to submit response" });
  }
});

// Start the Server
app.listen(PORT, () => {
  console.log(`✅ Server running on http://localhost:${PORT}`);
});
