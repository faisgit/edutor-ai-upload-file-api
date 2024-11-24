import express from "express"
import AWS from "aws-sdk"
import multer from "multer"
import multerS3 from "multer-s3"
import dotenv from "dotenv"
import cors from 'cors'

dotenv.config()
const app = express();
// CORS configuration
app.use(cors());
app.use(express.json());

// Configure AWS
AWS.config.update({
    accessKeyId: process.env.AWS_ACCESS_KEY_ID,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
    region: process.env.AWS_REGION
});

// Create S3 instance
const s3 = new AWS.S3();
const bucketName = process.env.AWS_BUCKET_NAME;

// Configure multer with S3
const upload = multer({
    storage: multerS3({
      s3: s3,
      bucket: bucketName,
      ACL: 'public-read', // Make sure your bucket allows this
      metadata: (req, file, cb) => {
        cb(null, { fieldName: file.fieldname });
      },
      key: (req, file, cb) => {
        const fileName = `${Date.now()}-${file.originalname.replace(/\s+/g, '-')}`;
        cb(null, fileName);
      },
    }),
    limits: {
      fileSize: 10 * 1024 * 1024, // 10MB limit
    },
    fileFilter: (req, file, cb) => {
      // Allow only jpg and png files
      const allowedTypes = ['image/jpeg', 'image/png'];
      if (allowedTypes.includes(file.mimetype)) {
        cb(null, true);
      } else {
        cb(new Error('Only .jpg and .png files are allowed!'), false);
      }
    },
  });
  
  // Test S3 connection
  s3.listBuckets((err, data) => {
    if (err) {
      console.error('Error connecting to S3:', err);
    } else {
      console.log('Successfully connected to S3');
    }
  });
  
  // Upload endpoint
  app.post('/upload', (req, res) => {
    upload.single('file')(req, res, function (err) {
      if (err) {
        console.error('Upload error:', err);
        return res.status(400).json({
          error: 'Error uploading file',
          details: err.message,
        });
      }
  
      if (!req.file) {
        return res.status(400).json({
          error: 'No file provided',
          details: 'Please select a file to upload',
        });
      }
  
      console.log('File uploaded successfully:', req.file);
      res.json({
        message: 'File uploaded successfully',
        file: {
          location: req.file.location,
          key: req.file.key,
          size: req.file.size,
          mimetype: req.file.mimetype,
        },
      });
    });
  });

// Get all files
app.get('/files', (req, res) => {
    try {
        const params = {
            Bucket: bucketName,
        };

        s3.listObjects(params, (err, data) => {
            if (err) {
                console.error('Error listing objects:', err);
                return res.status(500).json({
                    error: 'Error retrieving files',
                    details: err.message
                });
            }
            const files = data.Contents.map(file => ({
                url: `https://${params.Bucket}.s3.amazonaws.com/${file.Key}`,
                key: file.Key,
                size: file.Size,
                lastModified: file.LastModified
            }));

            res.json(files);
        });
    } catch (error) {
        console.error('Error in GET /files:', error);
        res.status(500).json({
            error: 'Error retrieving files',
            details: error.message
        });
    }
});

// Delete file
app.delete('/files/:filename', (req, res) => {
    const params = {
        Bucket: bucketName,
        Key: req.params.filename
    };

    s3.deleteObject(params, (err, data) => {
        if (err) {
            console.error('Error deleting file:', err);
            return res.status(500).json({
                error: 'Error deleting file',
                details: err.message
            });
        }
        res.json({ message: 'File deleted successfully' });
    });
});

const PORT = 3000;
app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
    
});