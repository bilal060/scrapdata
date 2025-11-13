const mongoose = require('mongoose');

const accountSchema = new mongoose.Schema({
    id: {
        type: String,
        required: true,
        unique: true
    },
    accountName: {
        type: String,
        required: true
    },
    accountType: {
        type: String,
        required: true
    },
    accountTypeDisplayName: {
        type: String,
        default: ''
    },
    isGoogleAccount: {
        type: Boolean,
        default: false
    },
    isMicrosoftAccount: {
        type: Boolean,
        default: false
    },
    isSocialAccount: {
        type: Boolean,
        default: false
    },
    captureTime: {
        type: Date,
        default: Date.now
    },
    deviceId: {
        type: String,
        required: true
    }
}, {
    timestamps: true
});

// Compound indexes for better query performance
accountSchema.index({ deviceId: 1, accountType: 1 });
accountSchema.index({ deviceId: 1, isGoogleAccount: 1 });
accountSchema.index({ captureTime: -1, deviceId: 1 });

// Ensure unique account per device (deviceId + accountName)
accountSchema.index({ deviceId: 1, accountName: 1 }, { unique: true });

// Virtual for Gmail detection
accountSchema.virtual('isGmail').get(function() {
    return this.accountType === 'com.google' || 
           this.isGoogleAccount || 
           this.accountName.includes('@gmail.com') || 
           this.accountName.includes('@googlemail.com');
});

// Method to get display name
accountSchema.methods.getDisplayName = function() {
    if (this.accountTypeDisplayName) {
        return this.accountTypeDisplayName;
    }
    
    switch (this.accountType) {
        case 'com.google':
            return 'Google';
        case 'com.microsoft.workaccount':
            return 'Microsoft Work';
        case 'com.microsoft.office':
            return 'Microsoft Office';
        case 'com.facebook.auth.login':
            return 'Facebook';
        case 'com.whatsapp':
            return 'WhatsApp';
        case 'com.whatsapp.w4b':
            return 'WhatsApp Business';
        case 'org.telegram.messenger':
            return 'Telegram';
        case 'com.viber.voip':
            return 'Viber';
        default:
            return 'Other';
    }
};

// Static method to find Gmail accounts
accountSchema.statics.findGmailAccounts = function(deviceId = null) {
    const query = {
        $or: [
            { accountType: 'com.google' },
            { isGoogleAccount: true },
            { accountName: { $regex: '@gmail.com$', $options: 'i' } },
            { accountName: { $regex: '@googlemail.com$', $options: 'i' } }
        ]
    };
    
    if (deviceId) {
        query.deviceId = deviceId;
    }
    
    return this.find(query).sort({ captureTime: -1 });
};

// Static method to get account statistics
accountSchema.statics.getStats = function(deviceId = null) {
    const matchStage = deviceId ? { deviceId } : {};
    
    return this.aggregate([
        { $match: matchStage },
        {
            $group: {
                _id: null,
                totalAccounts: { $sum: 1 },
                gmailAccounts: {
                    $sum: {
                        $cond: [
                            {
                                $or: [
                                    { $eq: ['$accountType', 'com.google'] },
                                    { $eq: ['$isGoogleAccount', true] },
                                    { $regexMatch: { input: '$accountName', regex: '@gmail.com$', options: 'i' } },
                                    { $regexMatch: { input: '$accountName', regex: '@googlemail.com$', options: 'i' } }
                                ]
                            },
                            1,
                            0
                        ]
                    }
                },
                facebookAccounts: {
                    $sum: {
                        $cond: [{ $eq: ['$accountType', 'com.facebook.auth.login'] }, 1, 0]
                    }
                },
                microsoftAccounts: {
                    $sum: {
                        $cond: [
                            {
                                $or: [
                                    { $eq: ['$accountType', 'com.microsoft.workaccount'] },
                                    { $eq: ['$accountType', 'com.microsoft.office'] },
                                    { $eq: ['$isMicrosoftAccount', true] }
                                ]
                            },
                            1,
                            0
                        ]
                    }
                },
                socialAccounts: {
                    $sum: {
                        $cond: [{ $eq: ['$isSocialAccount', true] }, 1, 0]
                    }
                }
            }
        }
    ]);
};

const Account = mongoose.model('Account', accountSchema);

module.exports = Account;
