const mongoose = require('mongoose');

const RichMediaSchema = new mongoose.Schema({
  extractionTime: { type: Number, required: true },
  sourceType: { type: String, enum: ['notification', 'text_input', 'clipboard'], default: 'text_input' },
  sourceId: { type: String, default: '' },

  emailAddresses: { type: [String], default: [] },
  phoneNumbers: { type: [String], default: [] },
  urls: { type: [String], default: [] },
  extractedDates: { type: [String], default: [] },
  mentions: { type: [String], default: [] },
  hashtags: { type: [String], default: [] },
  codeSnippets: { type: [String], default: [] },
  ticketNumbers: { type: [String], default: [] },

  creditCardDetected: { type: Boolean, default: false },
  creditCardType: { type: String, default: '' },
  ssnDetected: { type: Boolean, default: false },

  emojiCount: { type: Number, default: 0 },
  emojiType: { type: String, default: '' },

  detectedLanguage: { type: String, default: 'en' },
  languageConfidence: { type: Number, default: 0 },
  sentiment: { type: String, enum: ['positive', 'negative', 'neutral', 'urgent'], default: 'neutral' },
  sentimentScore: { type: Number, default: 0 },

  imageAttachments: { type: [String], default: [] },
  videoAttachments: { type: [String], default: [] },
  audioAttachments: { type: [String], default: [] },

  deviceId: { type: String, index: true },
  packageName: { type: String, index: true },
  appName: { type: String, index: true },

  extractionConfidence: { type: Number, default: 1.0 },
  hasErrors: { type: Boolean, default: false },
  errorMessage: { type: String, default: '' },

  createdAt: { type: Date, default: Date.now }
}, { timestamps: true });

module.exports = mongoose.model('RichMedia', RichMediaSchema);
