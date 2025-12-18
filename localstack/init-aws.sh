#!/bin/bash

echo "Initializing LocalStack..."

# Create S3 bucket for file uploads
awslocal s3 mb s3://local-uploads

# Verify SES email identity (required for sending emails)
awslocal ses verify-email-identity --email-address noreply@localhost.com

echo "LocalStack initialization complete!"
echo "S3 bucket: local-uploads"
echo "SES verified email: noreply@localhost.com"
