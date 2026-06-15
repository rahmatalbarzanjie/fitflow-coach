-- Add generate_content to ai_request_type enum
ALTER TYPE ai_request_type ADD VALUE IF NOT EXISTS 'generate_content';
