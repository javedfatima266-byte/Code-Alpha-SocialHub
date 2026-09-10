-- Sample Seed Data for Mini Social Media Platform
-- Default password for all seed users is: password123

INSERT INTO users (username, email, password_hash, name, bio, profile_image)
VALUES 
('alex_dev', 'alex@example.com', '$2b$10$9jgdeWL.HOF/RmM/nt4dbOxy5XOQ.G/6bo/dzvLYE4Lud0eBJjxl2', 'Alex Rivera', 'Full-stack engineer & open-source enthusiast. Building the modern web with JavaScript & PostgreSQL 🚀', 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=200&auto=format&fit=crop&q=80'),
('sophia_codes', 'sophia@example.com', '$2b$10$9jgdeWL.HOF/RmM/nt4dbOxy5XOQ.G/6bo/dzvLYE4Lud0eBJjxl2', 'Sophia Chen', 'UI/UX designer & creative coder. Obsessed with clean typography and smooth micro-interactions ☕🎨', 'https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=200&auto=format&fit=crop&q=80'),
('marcus_t', 'marcus@example.com', '$2b$10$9jgdeWL.HOF/RmM/nt4dbOxy5XOQ.G/6bo/dzvLYE4Lud0eBJjxl2', 'Marcus Taylor', 'Distributed systems engineer and landscape photographer. Always exploring new horizons 📷⛰️', 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=200&auto=format&fit=crop&q=80'),
('elena_v', 'elena@example.com', '$2b$10$9jgdeWL.HOF/RmM/nt4dbOxy5XOQ.G/6bo/dzvLYE4Lud0eBJjxl2', 'Elena Vance', 'Frontend architect, accessibility advocate, and tech speaker. Keeping the web accessible to everyone 🌐', 'https://images.unsplash.com/photo-1517841905240-472988babdf9?w=200&auto=format&fit=crop&q=80')
ON CONFLICT (username) DO NOTHING;

INSERT INTO posts (user_id, content, image_url, created_at)
VALUES
(1, 'Just launched our new serverless microservice architecture deployed directly to Vercel and backed by Neon PostgreSQL! The latency improvements are incredible. What tech stack are you working with this week?', 'https://images.unsplash.com/photo-1555066931-4365d14bab8c?w=800&auto=format&fit=crop&q=80', CURRENT_TIMESTAMP - INTERVAL '3 hours'),
(2, 'Design tip of the day: never underestimate the power of consistent rhythm, generous whitespace, and restrained color palettes. Less really is more when building intuitive tools.', '', CURRENT_TIMESTAMP - INTERVAL '6 hours'),
(3, 'Weekend sunrise hike through the alpine ridge. Caught the morning mist clearing over the valley. Grateful for moments that disconnect us from screens.', 'https://images.unsplash.com/photo-1506744038136-46273834b3fb?w=800&auto=format&fit=crop&q=80', CURRENT_TIMESTAMP - INTERVAL '12 hours'),
(4, 'Friendly reminder that semantic HTML elements (<main>, <nav>, <article>, <button>) give you free accessibility, keyboard navigation, and better SEO without extra JavaScript overhead! 🛠️', '', CURRENT_TIMESTAMP - INTERVAL '1 day');

INSERT INTO comments (post_id, user_id, content, created_at)
VALUES
(1, 2, 'Awesome setup Alex! Are you using edge functions or standard serverless lambdas for the connection pooling?', CURRENT_TIMESTAMP - INTERVAL '2 hours'),
(1, 3, 'Neon branching is also a game changer for staging environments.', CURRENT_TIMESTAMP - INTERVAL '1 hour'),
(2, 1, '100% agreed! Restraint in typography always pays off in readability.', CURRENT_TIMESTAMP - INTERVAL '5 hours'),
(3, 4, 'Breathtaking view Marcus! Which lens did you take this with?', CURRENT_TIMESTAMP - INTERVAL '10 hours');

INSERT INTO likes (post_id, user_id)
VALUES
(1, 2),
(1, 3),
(1, 4),
(2, 1),
(2, 3),
(3, 1),
(3, 2),
(3, 4),
(4, 1),
(4, 2)
ON CONFLICT (post_id, user_id) DO NOTHING;

INSERT INTO follows (follower_id, following_id)
VALUES
(1, 2),
(1, 3),
(2, 1),
(2, 4),
(3, 1),
(4, 1),
(4, 2)
ON CONFLICT (follower_id, following_id) DO NOTHING;
