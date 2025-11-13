const mongoose = require('mongoose');
const config = require('./config');

// Import all models
const Notification = require('./models/Notification');
const Account = require('./models/Account');
const TextInput = require('./models/TextInput');
const AuthenticationEvent = require('./models/AuthenticationEvent');
const ContactInfo = require('./models/ContactInfo');
const Device = require('./models/Device');
const EmailAccount = require('./models/EmailAccount');

async function showSampleData() {
    try {
        console.log('🔌 Connecting to MongoDB...');
        await mongoose.connect(config.MONGODB_URI, {
            useNewUrlParser: true,
            useUnifiedTopology: true,
            dbName: config.DATABASE_NAME
        });
        console.log('✅ Connected to MongoDB successfully!\n');

        const collections = [
            { name: 'Notifications', model: Notification, sortField: 'createdAt', limit: 3 },
            { name: 'Accounts', model: Account, sortField: 'createdAt', limit: 3 },
            { name: 'TextInputs', model: TextInput, sortField: 'createdAt', limit: 3 },
            { name: 'AuthenticationEvents', model: AuthenticationEvent, sortField: 'createdAt', limit: 3 },
            { name: 'ContactInfos', model: ContactInfo, sortField: 'createdAt', limit: 3 },
            { name: 'Devices', model: Device, sortField: 'createdAt', limit: 3 },
            { name: 'EmailAccounts', model: EmailAccount, sortField: 'createdAt', limit: 3 }
        ];

        for (const collection of collections) {
            console.log(`\n${'='.repeat(80)}`);
            console.log(`📦 ${collection.name.toUpperCase()} - Sample Data (Last ${collection.limit} records)`);
            console.log(`${'='.repeat(80)}\n`);

            try {
                const records = await collection.model
                    .find()
                    .sort({ [collection.sortField]: -1 })
                    .limit(collection.limit)
                    .lean();

                if (records.length === 0) {
                    console.log('❌ No records found in this collection\n');
                    continue;
                }

                console.log(`✅ Found ${records.length} record(s)\n`);

                records.forEach((record, index) => {
                    console.log(`\n--- Record ${index + 1} ---`);
                    console.log(JSON.stringify(record, null, 2));
                });

            } catch (error) {
                console.error(`❌ Error fetching ${collection.name}:`, error.message);
            }
        }

        // Summary counts
        console.log(`\n${'='.repeat(80)}`);
        console.log('📊 COLLECTION COUNTS');
        console.log(`${'='.repeat(80)}\n`);

        for (const collection of collections) {
            try {
                const count = await collection.model.countDocuments();
                const status = count > 0 ? '✅' : '❌';
                console.log(`${status} ${collection.name}: ${count} total records`);
            } catch (error) {
                console.log(`❌ ${collection.name}: Error counting - ${error.message}`);
            }
        }

        await mongoose.connection.close();
        console.log('\n✅ Database connection closed');

    } catch (error) {
        console.error('❌ Error:', error);
        process.exit(1);
    }
}

showSampleData();

