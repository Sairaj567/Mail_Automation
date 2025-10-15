const mongoose = require('mongoose');
const Job = require('./models/Job');

const demoJobs = [
    {
        title: "Software Engineer Intern",
        company: "Google",
        location: "Mountain View, CA",
        jobType: "internship",
        salary: "$7,500/month",
        description: "Join Google as a Software Engineer Intern and work on cutting-edge technologies...",
        requirements: ["Python", "Java", "Algorithms", "Data Structures"],
        responsibilities: ["Develop software solutions", "Collaborate with teams", "Write clean code"],
        skills: ["Python", "Java", "Machine Learning", "Cloud"],
        experienceLevel: "fresher",
        isActive: true
    },
    {
        title: "Frontend Developer",
        company: "Microsoft",
        location: "Redmond, WA",
        jobType: "fulltime",
        salary: "$95,000/year",
        description: "Microsoft is looking for a passionate Frontend Developer to join our dynamic team...",
        requirements: ["React", "TypeScript", "JavaScript", "CSS"],
        responsibilities: ["Build user interfaces", "Optimize performance", "Collaborate with designers"],
        skills: ["React", "TypeScript", "JavaScript", "CSS3"],
        experienceLevel: "0-2",
        isActive: true
    }
    // Add more demo jobs as needed
];

async function seedDemoData() {
    try {
        await mongoose.connect('mongodb://localhost:27017/placement_portal');
        
        // Clear existing jobs
        await Job.deleteMany({});
        
        // Insert demo jobs
        await Job.insertMany(demoJobs);
        
        console.log('Demo data seeded successfully!');
        process.exit(0);
    } catch (error) {
        console.error('Error seeding demo data:', error);
        process.exit(1);
    }
}

// Run if called directly
if (require.main === module) {
    seedDemoData();
}

module.exports = seedDemoData;