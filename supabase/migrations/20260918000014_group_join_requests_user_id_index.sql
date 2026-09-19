-- Advisor-flagged unindexed FK (group_join_requests.user_id).
create index if not exists group_join_requests_user_id_idx on public.group_join_requests (user_id);
