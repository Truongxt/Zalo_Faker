const mongoose = require('mongoose');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '.env') });

async function migrate() {
    try {
        const uri = process.env.MONGODB_URI || 'mongodb://localhost:27017/zalo_faker';
        await mongoose.connect(uri);
        console.log('Connected to MongoDB');

        const Conversation = mongoose.model('Conversation', new mongoose.Schema({}, { strict: false }));

        const result = await Conversation.updateMany(
            { type: 'group' },
            { 
                $set: { 
                    'groupSettings.permissions.pinMessage': 'all' 
                } 
            }
        );

        console.log(`Updated ${result.modifiedCount} groups.`);
        process.exit(0);
    } catch (err) {
        console.error(err);
        process.exit(1);
    }
}

migrate();
