-- KSA V2 Authentication System Database Schema
-- Run these commands in your Supabase SQL Editor

-- Enable Row Level Security
ALTER TABLE auth.users ENABLE ROW LEVEL SECURITY;

-- 1. Users Profile Table
CREATE TABLE IF NOT EXISTS public.users_profile (
    id UUID REFERENCES auth.users(id) ON DELETE CASCADE PRIMARY KEY,
    email TEXT NOT NULL UNIQUE,
    role TEXT NOT NULL CHECK (role IN ('super_admin', 'admin', 'user')) DEFAULT 'user',
    status TEXT NOT NULL CHECK (status IN ('pending', 'approved', 'suspended')) DEFAULT 'pending',
    invited_by UUID REFERENCES auth.users(id),
    approved_by UUID REFERENCES auth.users(id),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    approved_at TIMESTAMP WITH TIME ZONE,
    CONSTRAINT valid_approval CHECK (
        (status = 'approved' AND approved_by IS NOT NULL AND approved_at IS NOT NULL) OR
        (status != 'approved')
    )
);

-- 2. Invitations Table
CREATE TABLE IF NOT EXISTS public.invitations (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    email TEXT NOT NULL,
    invite_code TEXT NOT NULL UNIQUE,
    created_by UUID REFERENCES auth.users(id) NOT NULL,
    expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
    used_at TIMESTAMP WITH TIME ZONE,
    used_by UUID REFERENCES auth.users(id),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    CONSTRAINT valid_usage CHECK (
        (used_at IS NOT NULL AND used_by IS NOT NULL) OR
        (used_at IS NULL AND used_by IS NULL)
    )
);

-- 3. Page Permissions Table
CREATE TABLE IF NOT EXISTS public.page_permissions (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    page_path TEXT NOT NULL UNIQUE,
    min_required_role TEXT NOT NULL CHECK (min_required_role IN ('user', 'admin', 'super_admin')) DEFAULT 'admin',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_by TEXT NOT NULL DEFAULT 'system'
);

-- 4. Admin Actions Audit Table
CREATE TABLE IF NOT EXISTS public.admin_actions (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    admin_id UUID REFERENCES auth.users(id) NOT NULL,
    action_type TEXT NOT NULL,
    target_user UUID REFERENCES auth.users(id),
    details JSONB DEFAULT '{}',
    timestamp TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 5. Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_users_profile_email ON public.users_profile(email);
CREATE INDEX IF NOT EXISTS idx_users_profile_status ON public.users_profile(status);
CREATE INDEX IF NOT EXISTS idx_users_profile_role ON public.users_profile(role);
CREATE INDEX IF NOT EXISTS idx_invitations_code ON public.invitations(invite_code);
CREATE INDEX IF NOT EXISTS idx_invitations_email ON public.invitations(email);
CREATE INDEX IF NOT EXISTS idx_invitations_expires ON public.invitations(expires_at);
CREATE INDEX IF NOT EXISTS idx_page_permissions_path ON public.page_permissions(page_path);
CREATE INDEX IF NOT EXISTS idx_admin_actions_admin ON public.admin_actions(admin_id);
CREATE INDEX IF NOT EXISTS idx_admin_actions_timestamp ON public.admin_actions(timestamp);

-- 6. Row Level Security Policies

-- Users Profile Policies
CREATE POLICY "Users can view own profile" ON public.users_profile
    FOR SELECT USING (auth.uid() = id);

CREATE POLICY "Admins can view all profiles" ON public.users_profile
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM public.users_profile 
            WHERE id = auth.uid() 
            AND role IN ('admin', 'super_admin')
            AND status = 'approved'
        )
    );

CREATE POLICY "Users can update own profile" ON public.users_profile
    FOR UPDATE USING (auth.uid() = id)
    WITH CHECK (auth.uid() = id);

CREATE POLICY "Admins can update user profiles" ON public.users_profile
    FOR UPDATE USING (
        EXISTS (
            SELECT 1 FROM public.users_profile 
            WHERE id = auth.uid() 
            AND role IN ('admin', 'super_admin')
            AND status = 'approved'
        )
    );

CREATE POLICY "System can insert profiles" ON public.users_profile
    FOR INSERT WITH CHECK (true);

-- Invitations Policies
CREATE POLICY "Admins can manage invitations" ON public.invitations
    FOR ALL USING (
        EXISTS (
            SELECT 1 FROM public.users_profile 
            WHERE id = auth.uid() 
            AND role IN ('admin', 'super_admin')
            AND status = 'approved'
        )
    );

CREATE POLICY "Users can view own invitations" ON public.invitations
    FOR SELECT USING (
        email = (SELECT email FROM auth.users WHERE id = auth.uid())
    );

-- Page Permissions Policies
CREATE POLICY "Everyone can read page permissions" ON public.page_permissions
    FOR SELECT USING (true);

CREATE POLICY "Admins can manage page permissions" ON public.page_permissions
    FOR ALL USING (
        EXISTS (
            SELECT 1 FROM public.users_profile 
            WHERE id = auth.uid() 
            AND role IN ('admin', 'super_admin')
            AND status = 'approved'
        )
    );

-- Admin Actions Policies
CREATE POLICY "Admins can view admin actions" ON public.admin_actions
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM public.users_profile 
            WHERE id = auth.uid() 
            AND role IN ('admin', 'super_admin')
            AND status = 'approved'
        )
    );

CREATE POLICY "Admins can insert admin actions" ON public.admin_actions
    FOR INSERT WITH CHECK (
        admin_id = auth.uid() AND
        EXISTS (
            SELECT 1 FROM public.users_profile 
            WHERE id = auth.uid() 
            AND role IN ('admin', 'super_admin')
            AND status = 'approved'
        )
    );

-- 7. Functions and Triggers

-- Function to automatically create user profile on signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
    -- Only create profile if it doesn't exist (for invite-based registration)
    IF NOT EXISTS (SELECT 1 FROM public.users_profile WHERE id = NEW.id) THEN
        INSERT INTO public.users_profile (id, email, role, status)
        VALUES (NEW.id, NEW.email, 'user', 'pending');
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger for new user signup
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
    AFTER INSERT ON auth.users
    FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- Function to send email notification when user registers
CREATE OR REPLACE FUNCTION public.notify_admin_new_registration()
RETURNS TRIGGER AS $$
BEGIN
    -- This would integrate with your email service
    -- For now, we'll just log it
    INSERT INTO public.admin_actions (admin_id, action_type, target_user, details)
    SELECT 
        up.id,
        'new_user_registered',
        NEW.id,
        jsonb_build_object(
            'user_email', NEW.email,
            'registration_time', NOW()
        )
    FROM public.users_profile up
    WHERE up.role IN ('admin', 'super_admin') AND up.status = 'approved'
    LIMIT 1;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger for new user registration notification
DROP TRIGGER IF EXISTS on_user_profile_created ON public.users_profile;
CREATE TRIGGER on_user_profile_created
    AFTER INSERT ON public.users_profile
    FOR EACH ROW 
    WHEN (NEW.status = 'pending')
    EXECUTE FUNCTION public.notify_admin_new_registration();

-- 8. Insert default page permissions for existing pages
INSERT INTO public.page_permissions (page_path, min_required_role, updated_by) VALUES
    ('/', 'user', 'system'),
    ('/order-analysis', 'user', 'system'),
    ('/po', 'user', 'system'),
    ('/admin', 'admin', 'system'),
    ('/dashboard', 'user', 'system')
ON CONFLICT (page_path) DO NOTHING;

-- 9. Create your first super admin (REPLACE WITH YOUR EMAIL)
-- Uncomment and modify the email below, then run this separately after creating your account
/*
UPDATE public.users_profile 
SET role = 'super_admin', status = 'approved', approved_at = NOW(), approved_by = id
WHERE email = 'your-email@example.com';
*/

-- 10. Enable realtime for admin notifications (optional)
ALTER PUBLICATION supabase_realtime ADD TABLE public.users_profile;
ALTER PUBLICATION supabase_realtime ADD TABLE public.admin_actions;
