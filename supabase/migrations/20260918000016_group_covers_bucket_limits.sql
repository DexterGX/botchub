-- Now that a real upload flow exists (CreateGroupForm), give the bucket
-- server-side limits matching what the form itself restricts client-side
-- (image/png, image/jpeg, image/webp; 5MB) as defense in depth.
update storage.buckets
set file_size_limit = 5242880,
    allowed_mime_types = array['image/png', 'image/jpeg', 'image/webp']
where id = 'group-covers';
