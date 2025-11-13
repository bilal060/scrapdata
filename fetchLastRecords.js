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

// Helper function to analyze field completeness
function analyzeFields(records, modelName) {
    if (records.length === 0) {
        return {
            totalRecords: 0,
            fields: {},
            missingFields: [],
            emptyFields: []
        };
    }

    const fields = {};
    const requiredFields = [];
    const optionalFields = [];
    
    // Get schema paths to determine required vs optional fields
    const schema = records[0].constructor.schema;
    const paths = schema.paths;
    
    Object.keys(paths).forEach(fieldName => {
        const field = paths[fieldName];
        if (field.isRequired) {
            requiredFields.push(fieldName);
        } else {
            optionalFields.push(fieldName);
        }
    });

    // Analyze each field
    Object.keys(paths).forEach(fieldName => {
        if (fieldName === '_id' || fieldName === '__v') return;
        
        const field = paths[fieldName];
        const fieldType = field.instance;
        let presentCount = 0;
        let emptyCount = 0;
        let nonEmptyCount = 0;
        const sampleValues = [];

        records.forEach(record => {
            const value = record[fieldName];
            if (value !== undefined && value !== null) {
                presentCount++;
                if (fieldType === 'String' && value === '') {
                    emptyCount++;
                } else if (fieldType === 'Array' && value.length === 0) {
                    emptyCount++;
                } else if (fieldType === 'Object' && Object.keys(value).length === 0) {
                    emptyCount++;
                } else {
                    nonEmptyCount++;
                    if (sampleValues.length < 3) {
                        sampleValues.push(value);
                    }
                }
            }
        });

        fields[fieldName] = {
            type: fieldType,
            required: field.isRequired,
            present: presentCount,
            presentPercent: ((presentCount / records.length) * 100).toFixed(1),
            nonEmpty: nonEmptyCount,
            nonEmptyPercent: ((nonEmptyCount / records.length) * 100).toFixed(1),
            empty: emptyCount,
            sampleValues: sampleValues.slice(0, 3)
        };
    });

    // Identify missing/empty fields
    const missingFields = requiredFields.filter(field => {
        const fieldData = fields[field];
        return fieldData && fieldData.nonEmptyPercent < 100;
    });

    const emptyFields = optionalFields.filter(field => {
        const fieldData = fields[field];
        return fieldData && fieldData.nonEmptyPercent < 50; // Less than 50% populated
    });

    return {
        totalRecords: records.length,
        fields,
        missingFields,
        emptyFields,
        requiredFields,
        optionalFields
    };
}

// Helper function to format output
function formatAnalysis(collectionName, analysis) {
    console.log(`\n${'='.repeat(80)}`);
    console.log(`Collection: ${collectionName}`);
    console.log(`Total Records: ${analysis.totalRecords}`);
    console.log(`${'='.repeat(80)}`);

    if (analysis.totalRecords === 0) {
        console.log('⚠️  No records found in this collection');
        return;
    }

    console.log(`\n📊 Field Analysis:`);
    console.log(`Required Fields: ${analysis.requiredFields.length}`);
    console.log(`Optional Fields: ${analysis.optionalFields.length}`);

    if (analysis.missingFields.length > 0) {
        console.log(`\n❌ Missing/Incomplete Required Fields:`);
        analysis.missingFields.forEach(field => {
            const fieldData = analysis.fields[field];
            console.log(`  - ${field} (${fieldData.nonEmptyPercent}% populated, Type: ${fieldData.type})`);
        });
    }

    if (analysis.emptyFields.length > 0) {
        console.log(`\n⚠️  Under-populated Optional Fields (<50%):`);
        analysis.emptyFields.forEach(field => {
            const fieldData = analysis.fields[field];
            console.log(`  - ${field} (${fieldData.nonEmptyPercent}% populated, Type: ${fieldData.type})`);
        });
    }

    console.log(`\n✅ Well-populated Fields (>80%):`);
    Object.keys(analysis.fields).forEach(field => {
        const fieldData = analysis.fields[field];
        if (parseFloat(fieldData.nonEmptyPercent) >= 80) {
            const samples = fieldData.sampleValues.length > 0 
                ? ` | Samples: ${fieldData.sampleValues.map(v => 
                    typeof v === 'string' && v.length > 30 ? v.substring(0, 30) + '...' : String(v)
                ).join(', ')}`
                : '';
            console.log(`  - ${field}: ${fieldData.nonEmptyPercent}% (${fieldData.nonEmpty}/${analysis.totalRecords})${samples}`);
        }
    });

    // Show sample record structure
    if (analysis.totalRecords > 0) {
        console.log(`\n📝 Sample Record Structure (first record):`);
        const sample = analysis.totalRecords > 0 ? Object.keys(analysis.fields).reduce((acc, field) => {
            acc[field] = `[${analysis.fields[field].type}]`;
            return acc;
        }, {}) : {};
        console.log(JSON.stringify(sample, null, 2));
    }
}

// Main function
async function fetchAndAnalyze() {
    try {
        console.log('🔌 Connecting to MongoDB...');
        await mongoose.connect(config.MONGODB_URI, {
            useNewUrlParser: true,
            useUnifiedTopology: true,
            dbName: config.DATABASE_NAME
        });
        console.log('✅ Connected to MongoDB successfully!\n');

        const collections = [
            { name: 'notifications', model: Notification, sortField: 'createdAt' },
            { name: 'accounts', model: Account, sortField: 'createdAt' },
            { name: 'textinputs', model: TextInput, sortField: 'createdAt' },
            { name: 'authenticationevents', model: AuthenticationEvent, sortField: 'createdAt' },
            { name: 'contactinfos', model: ContactInfo, sortField: 'createdAt' },
            { name: 'devices', model: Device, sortField: 'createdAt' },
            { name: 'emailaccounts', model: EmailAccount, sortField: 'createdAt' }
        ];

        const results = {};

        for (const collection of collections) {
            try {
                console.log(`\n📥 Fetching last 20 records from ${collection.name}...`);
                const records = await collection.model
                    .find()
                    .sort({ [collection.sortField]: -1 })
                    .limit(20)
                    .lean();

                console.log(`✅ Found ${records.length} records`);
                
                // Convert back to Mongoose documents for schema analysis
                const documents = records.map(record => new collection.model(record));
                
                results[collection.name] = {
                    records: records,
                    analysis: analyzeFields(documents, collection.name)
                };
            } catch (error) {
                console.error(`❌ Error fetching ${collection.name}:`, error.message);
                results[collection.name] = {
                    records: [],
                    analysis: { totalRecords: 0, error: error.message }
                };
            }
        }

        // Display analysis
        console.log(`\n${'='.repeat(80)}`);
        console.log('📊 DATA ANALYSIS REPORT');
        console.log(`${'='.repeat(80)}`);

        for (const collection of collections) {
            formatAnalysis(collection.name, results[collection.name].analysis);
        }

        // Summary
        console.log(`\n${'='.repeat(80)}`);
        console.log('📈 SUMMARY');
        console.log(`${'='.repeat(80)}`);
        
        collections.forEach(collection => {
            const result = results[collection.name];
            const count = result.analysis.totalRecords || 0;
            const status = count > 0 ? '✅' : '❌';
            console.log(`${status} ${collection.name}: ${count} records`);
        });

        // Close connection
        await mongoose.connection.close();
        console.log('\n✅ Database connection closed');

    } catch (error) {
        console.error('❌ Error:', error);
        process.exit(1);
    }
}

// Run the script
fetchAndAnalyze();

