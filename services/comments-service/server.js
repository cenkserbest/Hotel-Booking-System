const express = require('express');
const cors = require('cors');
const mongoose = require('mongoose');

const app = express();
app.use(express.json());
app.use(cors());

const PORT = process.env.PORT || 3002;
const MONGO_URL = process.env.MONGO_URL || 'mongodb://admin:password@localhost:27017/comments_db?authSource=admin';

// ----------------------------------------------------
// MONGOOSE SCHEMA
// ----------------------------------------------------
const commentSchema = new mongoose.Schema({
  hotelId: { type: Number, required: true },
  userId: { type: String, required: true }, // From IAM
  userName: { type: String, required: true }, // To display in UI
  commentText: { type: String, required: true },
  // Ratings (1-10 scale)
  ratings: {
    temizlik: { type: Number, min: 1, max: 10, required: true },
    personelVeServis: { type: Number, min: 1, max: 10, required: true },
    imkanVeOzellikler: { type: Number, min: 1, max: 10, required: true },
    konaklamaYerininDurumu: { type: Number, min: 1, max: 10, required: true },
    cevreDostlugu: { type: Number, min: 1, max: 10, required: true },
  },
  overallRating: { type: Number, min: 1, max: 10 },
  createdAt: { type: Date, default: Date.now }
});

// Pre-save hook to calculate overall rating
commentSchema.pre('save', function(next) {
  const r = this.ratings;
  const avg = (r.temizlik + r.personelVeServis + r.imkanVeOzellikler + r.konaklamaYerininDurumu + r.cevreDostlugu) / 5;
  this.overallRating = Math.round(avg * 10) / 10; // 1 decimal place
  next();
});

const Comment = mongoose.model('Comment', commentSchema);

// ----------------------------------------------------
// ROUTES
// ----------------------------------------------------

// Add Comment
app.post('/api/comments/add', async (req, res) => {
  const userId = req.headers['x-user-id'];
  if (!userId) return res.status(401).json({ error: "Unauthorized" });

  try {
    const { hotelId, userName, commentText, ratings } = req.body;
    const comment = new Comment({ hotelId, userId, userName, commentText, ratings });
    await comment.save();
    res.status(201).json(comment);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to add comment" });
  }
});

// Get Comments & Aggregated Graph Data for a Hotel
app.get('/api/comments/hotel/:hotelId', async (req, res) => {
  try {
    const hotelId = parseInt(req.params.hotelId);
    
    // Fetch all comments for list view
    const comments = await Comment.find({ hotelId }).sort({ createdAt: -1 });

    // Aggregate to get average per category for the graph
    const aggregation = await Comment.aggregate([
      { $match: { hotelId: hotelId } },
      {
        $group: {
          _id: null,
          avgTemizlik: { $avg: "$ratings.temizlik" },
          avgPersonel: { $avg: "$ratings.personelVeServis" },
          avgImkan: { $avg: "$ratings.imkanVeOzellikler" },
          avgDurum: { $avg: "$ratings.konaklamaYerininDurumu" },
          avgCevre: { $avg: "$ratings.cevreDostlugu" },
          avgOverall: { $avg: "$overallRating" },
          totalComments: { $sum: 1 }
        }
      }
    ]);

    const graphData = aggregation.length > 0 ? {
      temizlik: Math.round(aggregation[0].avgTemizlik * 10) / 10,
      personelVeServis: Math.round(aggregation[0].avgPersonel * 10) / 10,
      imkanVeOzellikler: Math.round(aggregation[0].avgImkan * 10) / 10,
      konaklamaYerininDurumu: Math.round(aggregation[0].avgDurum * 10) / 10,
      cevreDostlugu: Math.round(aggregation[0].avgCevre * 10) / 10,
      overall: Math.round(aggregation[0].avgOverall * 10) / 10,
      totalCount: aggregation[0].totalComments
    } : null;

    res.json({
      graphData,
      comments
    });

  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to fetch comments" });
  }
});

// ----------------------------------------------------
// DB CONNECTION & SERVER START
// ----------------------------------------------------
mongoose.connect(MONGO_URL)
  .then(() => {
    console.log('Connected to MongoDB');
    app.listen(PORT, () => {
      console.log(`Comments Service running on port ${PORT}`);
    });
  })
  .catch(err => console.error('MongoDB connection error:', err));
