-- Enable realtime for services table
ALTER PUBLICATION supabase_realtime ADD TABLE services;

-- Enable realtime for promotions table
ALTER PUBLICATION supabase_realtime ADD TABLE promotions;
