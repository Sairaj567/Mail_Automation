const { describe, it, before, after } = require('node:test');
const assert = require('node:assert');
const fs = require('fs').promises;
const path = require('path');
const crypto = require('crypto');

// Mock the file upload and race condition handling
describe('File Upload Race Condition Prevention', () => {
    const testDir = path.join(__dirname, '../.test-uploads');
    
    before(async () => {
        // Create test directory
        await fs.mkdir(testDir, { recursive: true });
    });

    after(async () => {
        // Clean up test directory
        try {
            const files = await fs.readdir(testDir);
            for (const file of files) {
                await fs.unlink(path.join(testDir, file));
            }
            await fs.rmdir(testDir);
        } catch (err) {
            console.error('Cleanup error:', err);
        }
    });

    it('should write files atomically to prevent race conditions', async () => {
        // Simulate the atomic file write pattern
        const filename = 'test-file.txt';
        const tempFilename = `${filename}.tmp`;
        const content = Buffer.from('Test content');
        
        const tempPath = path.join(testDir, tempFilename);
        const finalPath = path.join(testDir, filename);

        // Write to temp file
        await fs.writeFile(tempPath, content);
        
        // Atomically rename
        await fs.rename(tempPath, finalPath);

        // Verify file exists at final location
        const finalContent = await fs.readFile(finalPath);
        assert.deepStrictEqual(finalContent, content, 'File content should match');
        
        // Verify temp file no longer exists
        let tempExists = false;
        try {
            await fs.access(tempPath);
            tempExists = true;
        } catch {
            tempExists = false;
        }
        assert.strictEqual(tempExists, false, 'Temp file should be removed after rename');
    });

    it('should generate unique filenames with crypto to prevent collisions', async () => {
        const filenames = new Set();
        
        // Generate 100 unique filenames
        for (let i = 0; i < 100; i++) {
            const uniqueId = crypto.randomBytes(8).toString('hex');
            const filename = `test-${uniqueId}-${Date.now()}.txt`;
            filenames.add(filename);
        }

        // All filenames should be unique
        assert.strictEqual(filenames.size, 100, 'All generated filenames should be unique');
    });

    it('should handle concurrent write operations safely', async () => {
        const writeCount = 10;
        const promises = [];

        for (let i = 0; i < writeCount; i++) {
            const promise = (async () => {
                const uniqueId = crypto.randomBytes(8).toString('hex');
                const filename = `concurrent-${uniqueId}.txt`;
                const tempFilename = `${filename}.tmp`;
                
                const tempPath = path.join(testDir, tempFilename);
                const finalPath = path.join(testDir, filename);
                
                const content = Buffer.from(`Content ${i}`);
                
                // Write to temp, then rename
                await fs.writeFile(tempPath, content);
                await fs.rename(tempPath, finalPath);
                
                return finalPath;
            })();
            
            promises.push(promise);
        }

        const results = await Promise.all(promises);
        
        // Verify all files were written
        assert.strictEqual(results.length, writeCount, 'All concurrent writes should complete');
        
        // Verify all files exist and have content
        for (const filepath of results) {
            const content = await fs.readFile(filepath);
            assert.ok(content.length > 0, `File ${filepath} should have content`);
        }
    });

    it('should handle file write errors gracefully', async () => {
        // Try to write to invalid directory
        const invalidPath = path.join(testDir, 'invalid', 'nested', 'file.txt');
        
        try {
            await fs.writeFile(invalidPath, Buffer.from('test'));
            assert.fail('Should have thrown an error');
        } catch (err) {
            assert.ok(err instanceof Error, 'Should throw an error for invalid path');
        }
    });
});
