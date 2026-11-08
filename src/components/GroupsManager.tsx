import { useState, useEffect, useCallback, lazy, Suspense, useRef } from 'react';
import { useSupabase } from '@/lib/supabase/context';
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Switch } from "@/components/ui/switch";
import Image from 'next/image';
import { 
  Plus, 
  Users, 
  Search, 
  Lock, 
  Unlock, 
  CheckCircle2, 
  XCircle, 
  Loader2, 
  DoorOpen, 
  UserPlus,
  MessageSquare,
  Building,
  Smile,
  X,
  PlusCircle,
  ChevronRight,
  Share2
} from 'lucide-react';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Input } from '@/components/ui/input';
import { ScrollArea } from "@/components/ui/scroll-area";
import { EmojiStyle, Theme, Categories } from 'emoji-picker-react';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { useGroup } from '@/lib/group/context';
import GroupCard from './GroupCard';
import { AnimatePresence, motion } from 'framer-motion';
import { RealtimeChannel } from '@supabase/supabase-js';
import { useTranslation } from 'react-i18next';
import ShareGroupAnimation from './ShareGroupAnimation';

// Import or define the necessary types
interface AppUser {
  id: string;
  username: string;
  [key: string]: unknown;
}

interface UserData {
  id: string;
  username: string;
  bio?: string | null;
  is_banned?: boolean;
  avatar_url?: string | null;
  email?: string;
}

// Lazy load the emoji picker
const EmojiPicker = lazy(() => import('emoji-picker-react'));

// Custom CSS class to prevent zoom on mobile inputs
const noZoomInputClass = "text-[16px] sm:text-sm [-webkit-text-size-adjust:100%] [text-size-adjust:100%]";

export type Group = {
  id: number;
  name: string;
  created_at?: string;
  created_by?: string;
  is_publicly_joinable?: boolean;
  description?: string;
  memberCount?: number;
};

interface GroupsManagerProps {
  user: AppUser;
  isMobile?: boolean;
}

// Add the new GroupSettings component before the main GroupsManager component
interface GroupSettingsProps {
  isPubliclyJoinable: boolean;
  setIsPubliclyJoinable: (value: boolean) => void;
  isEditing?: boolean;
}

const GroupSettings = ({ isPubliclyJoinable, setIsPubliclyJoinable, isEditing = false }: GroupSettingsProps) => {
  const { t } = useTranslation('GroupsManager');

  return (
  <div className="rounded-lg bg-muted/30 p-4 border border-muted/50">
    <div className="flex items-center justify-between flex-wrap gap-2">
      <div className="flex items-center gap-2 min-w-0 flex-1">
        <div className={cn(
          "w-8 h-8 shrink-0 rounded-full flex items-center justify-center",
          isPubliclyJoinable ? "bg-green-100 text-green-600" : "bg-amber-100 text-amber-600"
        )}>
          {isPubliclyJoinable ? <Unlock className="h-4 w-4" /> : <Lock className="h-4 w-4" />}
        </div>
        <div className="min-w-0">
          <p className="font-medium text-sm truncate">{isPubliclyJoinable ? t('Accès libre') : t('Accès sur approbation')}</p>
          <p className="text-xs text-muted-foreground truncate">{isPubliclyJoinable ? t('Tout le monde peut rejoindre') : t('Sur candidature uniquement')}</p>
        </div>
      </div>
      <Switch
        id={isEditing ? "editIsPubliclyJoinable" : "isPubliclyJoinable"}
        checked={isPubliclyJoinable}
        onCheckedChange={setIsPubliclyJoinable}
        className="data-[state=checked]:bg-green-500 data-[state=unchecked]:bg-amber-500 shrink-0"
      />
    </div>
  </div>
  );
};

// New UI components for the GroupsManager redesign
const GroupSelector = ({ 
  groups, 
  currentGroupId, 
  setCurrentGroupId,
  extractEmoji
}: { 
  groups: Group[], 
  currentGroupId: number | null, 
  setCurrentGroupId: (id: number | null) => void, 
  openGroupDialog: (tab: 'join' | 'create') => void,
  extractEmoji: (text: string) => string | undefined
}) => {
  const { t } = useTranslation('GroupsManager');
  
  // Get current group
  const currentGroup = currentGroupId ? groups.find(g => g.id === currentGroupId) : null;
  
  const currentGroupEmoji = currentGroup ? extractEmoji(currentGroup.name) : undefined;
  const currentGroupDisplayName = currentGroup 
    ? (currentGroupEmoji ? currentGroup.name.replace(currentGroupEmoji, '').trim() : currentGroup.name)
    : '';

  // Don't render anything if no group is selected
  if (!currentGroup) return null;

  return (
    <div className="relative w-full">
      {/* Simple header showing current group with back arrow */}
      <div className="flex items-center bg-background rounded-xl  pr-5 py-2.5">
        {currentGroup && (
          <>
            <button 
              onClick={() => setCurrentGroupId(null)}
              className="mr-2 p-1 rounded-full hover:bg-muted/70 transition-colors"
              aria-label={t('Revenir à la liste des salles')}
            >
              <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-muted-foreground">
                <path d="m15 18-6-6 6-6"/>
              </svg>
            </button>
            <div className="flex items-center gap-3 flex-1 min-w-0">
              <div className="h-8 w-8 rounded-full bg-gradient-to-br from-primary/20 to-primary/10 flex items-center justify-center ring-2 ring-primary/20">
                {currentGroupEmoji ? (
                  <span className="text-lg">{currentGroupEmoji}</span>
                ) : (
                  <Building className="h-4 w-4 text-primary/70" />
                )}
              </div>
              <h2 className="font-medium text-lg truncate">{currentGroupDisplayName}</h2>
            </div>
          </>
        )}
      </div>
    </div>
  );
};

export default function GroupsManager({
  user,
  isMobile,
}: GroupsManagerProps) {
  const { currentGroupId, setCurrentGroupId, userGroups, setUserGroups, loadUserGroups } = useGroup();
  
  // Extract emoji from group name - moved to component level for reuse
  const extractEmoji = (text: string): string | undefined => {
    // Match emoji that are rendered as graphical symbols rather than text symbols
    const emojiPattern = /(\p{Emoji_Presentation}|\p{Emoji}\uFE0F)/u;
    return text.match(emojiPattern)?.[0];
  };
  // Initialize hasLoaded as true if we already have groups in the context
  const [hasLoaded, setHasLoaded] = useState(userGroups.length > 0);
  
  // Log when isMobile changes to help with debugging
  useEffect(() => {
    console.debug('GroupsManager: isMobile state changed to', isMobile);
  }, [isMobile]);

  const { t } = useTranslation('GroupsManager');
  
  const [isGroupDialogOpen, setIsGroupDialogOpen] = useState(false);
  const [groupDialogTab, setGroupDialogTab] = useState<'join' | 'create' | 'manage'>('join');
  const [availableGroups, setAvailableGroups] = useState<Group[]>([]);
  const [recommendedGroups, setRecommendedGroups] = useState<Group[]>([]);
  const [isLoadingRecommendations, setIsLoadingRecommendations] = useState(false);
  const [pendingJoinRequests, setPendingJoinRequests] = useState<number[]>([]);
  const [selectedAvailableGroup, setSelectedAvailableGroup] = useState<Group | null>(null);
  const [joinRequestMessage, setJoinRequestMessage] = useState('');
  const [isJoinRequestSubmitting, setIsJoinRequestSubmitting] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  
  const [newGroupName, setNewGroupName] = useState('');
  const [isCreatingGroup, setIsCreatingGroup] = useState(false);
  const [groupNameStatus, setGroupNameStatus] = useState<'checking' | 'available' | 'taken' | null>(null);
  const [isPubliclyJoinable, setIsPubliclyJoinable] = useState(false);
  const [newGroupDescription, setNewGroupDescription] = useState('');
  
  const [isEditGroupDialogOpen, setIsEditGroupDialogOpen] = useState(false);
  const [groupToEdit, setGroupToEdit] = useState<Group | null>(null);
  const [editIsPubliclyJoinable, setEditIsPubliclyJoinable] = useState(false);
  const [isUpdatingGroup, setIsUpdatingGroup] = useState(false);
  
  const [groupMembers, setGroupMembers] = useState<UserData[]>([]);
  const [isLoadingMembers, setIsLoadingMembers] = useState(false);
  const [selectedGroupForMembers, setSelectedGroupForMembers] = useState<number | null>(null);

  const [userSearchQuery, setUserSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<UserData[]>([]);
  const [isLoadingUsers, setIsLoadingUsers] = useState(false);
  
  const [memberSearchQuery, setMemberSearchQuery] = useState('');
  
  const [isDeleteConfirmationOpen, setIsDeleteConfirmationOpen] = useState(false);
  const [isLeaveConfirmationOpen, setIsLeaveConfirmationOpen] = useState(false);
  const [groupToLeave, setGroupToLeave] = useState<Group | null>(null);
  const [groupToDelete, setGroupToDelete] = useState<Group | null>(null);
  
  const [selectedEmoji, setSelectedEmoji] = useState<string>('');
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  
  const [editGroupDescription, setEditGroupDescription] = useState('');
  
  // Share animation state
  const [showShareAnimation, setShowShareAnimation] = useState(false);
  const [newlyCreatedGroup, setNewlyCreatedGroup] = useState<Group | null>(null);
  
  const supabase = useSupabase();
  const subscriptionRef = useRef<RealtimeChannel | null>(null);
  const recommendationsLoadedRef = useRef(false);

  // Replace the existing fetchUserGroups with a wrapper around the context function
  const fetchUserGroups = useCallback(async () => {
    if (!user) {
      setHasLoaded(true);
      return;
    }
    
    try {
      // Only load groups if we don't already have them
      if (userGroups.length === 0) {
        await loadUserGroups(user.id);
      }
    } catch (error) {
      console.error('Error in fetchUserGroups:', error);
    } finally {
      setHasLoaded(true);
    }
  }, [user, loadUserGroups, userGroups.length]);

  const fetchAvailableGroups = useCallback(async () => {
    try {
      if (!user) {
        return;
      }
      
      const { data: memberships } = await supabase
        .from('UsersGroupMembership')
        .select('group')
        .eq('user', user.id);
      
      const userGroupIds = memberships?.map(m => m.group) || [];
      
      // Fetch pending join requests
      const { data: pendingRequests, error: pendingError } = await supabase
        .from('RequestJoinGroup')
        .select('group')
        .eq('user', user.id);
        
      if (pendingError) throw pendingError;
      
      setPendingJoinRequests(pendingRequests?.map(r => r.group) || []);
      
      const { data: allGroups, error } = await supabase
        .from('Group')
        .select('id, name, is_publicly_joinable, description');
      
      if (error) throw error;
      
      const filtered = allGroups?.filter(group => !userGroupIds.includes(group.id)) || [];
      
      // Fetch member counts for each group
      const groupsWithMembers = await Promise.all(filtered.map(async (group) => {
        // Count members for this group
        const { data: groupMembers, error: countError } = await supabase
          .from('UsersGroupMembership')
          .select('user', { count: 'exact' })
          .eq('group', group.id);
        
        if (countError) {
          console.error('Error counting members:', countError);
          return { ...group, memberCount: 0 };
        }
        
        return { ...group, memberCount: groupMembers?.length || 0 };
      }));
      
      setAvailableGroups(groupsWithMembers);
    } catch (error) {
      console.error('Error fetching available groups:', error);
    }
  }, [supabase, user]);

  const fetchGroupMembers = async (groupId: number) => {
    try {
      setIsLoadingMembers(true);
      setSelectedGroupForMembers(groupId);
      
      // First get all membership records for this group
      const { data: memberships, error: membershipError } = await supabase
        .from('UsersGroupMembership')
        .select('user')
        .eq('group', groupId);
      
      if (membershipError) throw membershipError;
      
      if (memberships && memberships.length > 0) {
        const userIds = memberships.map(m => m.user);
        
        // Then fetch user details for each member
        const { data: users, error: usersError } = await supabase
          .from('Users')
          .select('id, username, bio, is_banned')
          .in('id', userIds);
        
        if (usersError) throw usersError;
        
        setGroupMembers(users || []);
      } else {
        setGroupMembers([]);
      }
    } catch (error) {
      console.error('Error fetching group members:', error);
      toast.error(t("Erreur lors de la récupération des membres"));
    } finally {
      setIsLoadingMembers(false);
    }
  };

  const handleKickMember = async (groupId: number, memberId: string) => {
    try {
      if (!user) {
        toast.error(t("Vous devez être connecté pour effectuer cette action"));
        return;
      }
      
      // Check if user is the group creator
      const group = userGroups.find(g => g.id === groupId);
      if (!group || group.created_by !== user.id) {
        toast.error(t("Vous n'êtes pas autorisé à effectuer cette action"));
        return;
      }
      
      // Don't allow kicking yourself
      if (memberId === user.id) {
        toast.error(t("Vous ne pouvez pas vous exclure vous-même"));
        return;
      }
      
      // Optimistically update the UI
      setGroupMembers(prevMembers => prevMembers.filter(member => member.id !== memberId));
      
      // Update the memberCount in userGroups
      setUserGroups(prevGroups => prevGroups.map(group => 
        group.id === groupId 
          ? { ...group, memberCount: Math.max(0, (group.memberCount || 0) - 1) }
          : group
      ));
      
      // Perform the actual deletion in the background
      const { error } = await supabase
        .from('UsersGroupMembership')
        .delete()
        .eq('user', memberId)
        .eq('group', groupId);
      
      if (error) throw error;
      
      toast.success(t("Membre exclu de la salle avec succès"));
    } catch (error) {
      console.error('Error kicking member:', error);
      toast.error(t("Erreur lors de l'exclusion du membre"));
      
      // If there was an error, we need to fetch the member list again to restore correct state
      if (selectedGroupForMembers) {
        fetchGroupMembers(selectedGroupForMembers);
      }
    }
  };

  const handleSubmitJoinRequest = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    
    if (!selectedAvailableGroup) return;
    
    try {
      setIsJoinRequestSubmitting(true);
      
      if (!user) {
        toast.error(t("Vous devez être connecté pour demander à rejoindre une salle"));
        return;
      }
      
      const { data: existingRequests } = await supabase
        .from('RequestJoinGroup')
        .select('id')
        .eq('user', user.id)
        .eq('group', selectedAvailableGroup.id);
      
      if (existingRequests && existingRequests.length > 0) {
        toast.error(t("Votre demande est en cours d'examen"));
        return;
      }
      
      const { error } = await supabase
        .from('RequestJoinGroup')
        .insert({
          user: user.id,
          group: selectedAvailableGroup.id,
          message: joinRequestMessage
        });
      
      if (error) throw error;
      
      toast.success(t("Votre demande a été envoyée avec succès"));
      
      setPendingJoinRequests([...pendingJoinRequests, selectedAvailableGroup.id]);
      setJoinRequestMessage('');
      setSelectedAvailableGroup(null);
      setIsGroupDialogOpen(false);
    } catch (error) {
      console.error('Error submitting join request:', error);
      toast.error(t("Erreur lors de l'envoi de la demande"));
    } finally {
      setIsJoinRequestSubmitting(false);
    }
  };

  const handleCreateGroup = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    
    const trimmedName = newGroupName.trim();
    const trimmedDescription = newGroupDescription.trim();
    
    if (!trimmedName) {
      toast.error(t("Le nom de la salle est requis"));
      return;
    }

    if (!trimmedDescription) {
      toast.error(t("La description de la salle est requise"));
      return;
    }

    if (!selectedEmoji) {
      toast.error(t("Veuillez sélectionner un emoji pour la salle"));
      return;
    }
    
    if (trimmedName.length >= 15) {
      toast.error(t("Le nom de la salle doit contenir moins de 15 caractères"));
      return;
    }
    
    try {
      setIsCreatingGroup(true);
      
      if (!user) {
        toast.error(t("Vous devez être connecté pour créer une salle"));
        return;
      }
      
      // Check if user has already created a group
      const hasCreatedGroup = userGroups.some(group => group.created_by === user.id);
      if (hasCreatedGroup) {
        toast.error(t("Vous avez déjà créé une salle. Limite d'une salle par utilisateur."));
        return;
      }
      
      // Check if the combined name with emoji exists
      const combinedName = `${trimmedName} ${selectedEmoji}`;
      
      const { data: existingGroups, error: checkError } = await supabase
        .from('Group')
        .select('id')
        .ilike('name', combinedName);
      
      if (checkError) throw checkError;
      
      if (existingGroups && existingGroups.length > 0) {
        toast.error(t("Une salle avec ce nom existe déjà"));
        setGroupNameStatus('taken');
        return;
      }
      
      const { data: newGroup, error: createError } = await supabase
        .from('Group')
        .insert({
          name: combinedName,
          created_by: user.id,
          is_publicly_joinable: isPubliclyJoinable,
          description: trimmedDescription
        })
        .select()
        .single();
      
      if (createError) throw createError;
      
      const { error: membershipError } = await supabase
        .from('UsersGroupMembership')
        .insert({
          user: user.id,
          group: newGroup.id
        });
      
      if (membershipError) throw membershipError;
      
      // Check if user already has points in this group
      const { data: existingPoints, error: pointsCheckError } = await supabase
        .from('PointsHistory')
        .select('id')
        .eq('user', user.id)
        .eq('group', newGroup.id)
        .limit(1);
        
      if (pointsCheckError) {
        console.error('Error checking existing points:', pointsCheckError);
      }
      
      // If no existing points record, add initial 200 points
      if (!existingPoints || existingPoints.length === 0) {
        const { error: addPointsError } = await supabase
          .from('PointsHistory')
          .insert({
            user: user.id,
            group: newGroup.id,
            amount: 200,
            timestamp: new Date().toISOString()
          });
          
        if (addPointsError) {
          console.error('Error adding initial points:', addPointsError);
        } else {
          console.log('Added 200 initial points to user in group', newGroup.id);
        }
      }
      
      setUserGroups([...userGroups, newGroup]);
      setCurrentGroupId(newGroup.id);
      
      // Show share animation instead of just toast and closing dialog
      setNewlyCreatedGroup(newGroup);
      setShowShareAnimation(true);
      
      // Clear form and close dialog
      setNewGroupName('');
      setSelectedEmoji('');
      setNewGroupDescription('');
      setIsGroupDialogOpen(false);
    } catch (error) {
      console.error('Error creating group:', error);
      toast.error(t("Erreur lors de la création de la salle"));
    } finally {
      setIsCreatingGroup(false);
    }
  };

  const handleDirectJoin = async (groupId: number) => {
    try {
      if (!user) {
        toast.error(t("Vous devez être connecté pour rejoindre une salle"));
        return;
      }
      
      const { error } = await supabase
        .from('UsersGroupMembership')
        .insert({
          user: user.id,
          group: groupId
        });
      
      if (error) throw error;
      
      // Check if user already has points in this group
      const { data: existingPoints, error: pointsCheckError } = await supabase
        .from('PointsHistory')
        .select('id')
        .eq('user', user.id)
        .eq('group', groupId)
        .limit(1);
        
      if (pointsCheckError) {
        console.error('Error checking existing points:', pointsCheckError);
      }
      
      // If no existing points record, add initial 200 points
      if (!existingPoints || existingPoints.length === 0) {
        const { error: addPointsError } = await supabase
          .from('PointsHistory')
          .insert({
            user: user.id,
            group: groupId,
            amount: 200,
            timestamp: new Date().toISOString()
          });
          
        if (addPointsError) {
          console.error('Error adding initial points:', addPointsError);
        } else {
          console.log('Added 200 initial points to user in group', groupId);
        }
      }
      
      // Refresh user groups
      await fetchUserGroups();
      
      // Close the dialog and select the new group
      setCurrentGroupId(groupId);
      setIsGroupDialogOpen(false);
    } catch (error) {
      console.error('Error joining group:', error);
      toast.error(t("Erreur lors de la tentative de rejoindre la salle"));
    }
  };

  const openGroupDialog = (tab: 'join' | 'create') => {
    setGroupDialogTab(tab);
    setIsGroupDialogOpen(true);
    
    // When Explorer tab is clicked, refresh the list of groups in the background
    if (tab === 'join') {
      // We're intentionally not using await here to avoid blocking the UI
      fetchAvailableGroups();
    }
  };

  const fetchRecommendedGroups = useCallback(async () => {
    try {
      if (!user || recommendationsLoadedRef.current) {
        return;
      }
      
      setIsLoadingRecommendations(true);
      
      // Fetch all groups with their member counts
      const { data: allGroups, error } = await supabase
        .from('Group')
        .select('id, name, is_publicly_joinable, description');
      
      if (error) throw error;
      
      if (!allGroups) {
        setRecommendedGroups([]);
        return;
      }
      
      // Count members for each group
      const groupsWithMembers = await Promise.all(allGroups.map(async (group) => {
        // Count members for this group
        const { count, error: countError } = await supabase
          .from('UsersGroupMembership')
          .select('*', { count: 'exact', head: true }) 
          .eq('group', group.id);
        
        if (countError) {
          console.error('Error counting members:', countError);
          return { ...group, memberCount: 0 };
        }
        
        return { ...group, memberCount: count || 0 };
      }));
      
      // Sort by member count (highest first) and take top 5
      const sorted = groupsWithMembers
        .sort((a, b) => (b.memberCount || 0) - (a.memberCount || 0))
        .slice(0, 5);
      
      setRecommendedGroups(sorted);
      recommendationsLoadedRef.current = true;
    } catch (error) {
      console.error('Error fetching recommended groups:', error);
    } finally {
      setIsLoadingRecommendations(false);
    }
  }, [supabase, user]);

  // Separate useEffect for userGroups fetching
  useEffect(() => {
    if (user) {
      fetchUserGroups();
      fetchAvailableGroups();
    }
  }, [fetchUserGroups, fetchAvailableGroups, user]);

  // Separate useEffect for recommendations that runs only once
  useEffect(() => {
    if (user && userGroups.length === 0 && !recommendationsLoadedRef.current) {
      fetchRecommendedGroups();
    }
  }, [fetchRecommendedGroups, user, userGroups.length]);

  useEffect(() => {
    if (!newGroupName || groupDialogTab !== 'create') {
      setGroupNameStatus(null);
      return;
    }

    let isMounted = true;
    const timeoutId = setTimeout(async () => {
      if (isMounted) setGroupNameStatus('checking');
      
      const trimmedName = newGroupName.trim();
      
      if (trimmedName.length >= 15) {
        if (isMounted) setGroupNameStatus('taken');
        return;
      }
      
      try {
        // Check if the combined name with emoji exists
        const combinedName = `${trimmedName} ${selectedEmoji}`;
        
        const { data: existingGroups, error } = await supabase
          .from('Group')
          .select('id')
          .ilike('name', combinedName)
          .limit(1);
        
        if (!isMounted) return;
        
        if (error) {
          console.error('Error checking group name:', error);
          setGroupNameStatus(null);
          return;
        }
        
        setGroupNameStatus(existingGroups && existingGroups.length > 0 ? 'taken' : 'available');
      } catch (err) {
        console.error('Group name check failed:', err);
        if (isMounted) {
          setGroupNameStatus(null);
        }
      }
    }, 500);
    
    return () => {
      isMounted = false;
      clearTimeout(timeoutId);
    };
  }, [newGroupName, groupDialogTab, supabase, selectedEmoji]);

  // Fix TypeScript errors in the real-time subscription useEffect
  useEffect(() => {
    if (!user) return;

    // Set up subscription for membership changes
    const subscription = supabase
      .channel('user-group-membership-changes')
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'UsersGroupMembership',
          filter: `user=eq.${user.id}`
        },
        async (payload) => {
          console.log('New group membership detected:', payload);
          // Get the group ID from the new membership
          const groupId = payload.new.group;
          
          // Fetch the group details
          const { data: groupData, error } = await supabase
            .from('Group')
            .select('id, name, created_at, created_by, is_publicly_joinable, description')
            .eq('id', groupId)
            .single();
            
          if (error) {
            console.error('Error fetching new group:', error);
            return;
          }
          
          // Fetch member count for this group
          const { count, error: countError } = await supabase 
            .from('UsersGroupMembership')
            .select('*', { count: 'exact', head: true }) 
            .eq('group', groupId);

          if (countError) {
            console.error(`Could not fetch count for group ${groupId}:`, countError);
          }
          
          // Add the group to userGroups if it's not already there
          setUserGroups((prevGroups: Group[]) => {
            // Check if the group is already in the list
            if (prevGroups.some((g: Group) => g.id === groupId)) {
              return prevGroups;
            }
            
            // Add the new group with member count
            const newGroup = {
              ...groupData,
              memberCount: count || 0
            };
            
            // Return a new array with the group added
            const updatedGroups = [...prevGroups, newGroup];
            
            // Sort groups alphabetically
            return [...updatedGroups].sort((a, b) => a.name.localeCompare(b.name));
          });
          
          toast.success(`${t('Vous êtes maintenant membre de')} ${groupData.name}`);
        }
      )
      .on(
        'postgres_changes',
        {
          event: 'DELETE',
          schema: 'public',
          table: 'UsersGroupMembership',
          filter: `user=eq.${user.id}`
        },
        (payload) => {
          console.log('Group membership removed:', payload);
          // Identify the group that was removed
          // The old record contains the group ID that was deleted
          const groupId = payload.old.group;
          
          // Remove the group from userGroups
          setUserGroups((prevGroups: Group[]) => {
            const updatedGroups = prevGroups.filter((group: Group) => group.id !== groupId);
            
            // If the deleted group was the currently selected group, select another one if available
            if (currentGroupId === groupId) {
              if (updatedGroups.length > 0) {
                setCurrentGroupId(updatedGroups[0].id);
              } else {
                setCurrentGroupId(null);
              }
            }
            
            return updatedGroups;
          });
          
          toast.info(t("Vous avez été retiré d'une salle"));
        }
      )
      .subscribe();
    
    // Store the subscription reference for cleanup
    subscriptionRef.current = subscription;
    
    // Cleanup function to remove the subscription
    return () => {
      if (subscriptionRef.current) {
        supabase.removeChannel(subscriptionRef.current);
      }
    };
  }, [user, supabase, currentGroupId, setCurrentGroupId, setUserGroups]);


  const renderNoGroupsMessage = () => (
    <div className="flex flex-col items-center justify-center min-h-[400px] text-center py-12 px-6">
      {/* Hero Icon */}
      <div className="relative mb-8">
        <div className="w-20 h-20 rounded-full bg-gradient-to-br from-blue-100 to-purple-100 dark:from-blue-950/30 dark:to-purple-950/30 flex items-center justify-center shadow-lg">
          <Users className="h-10 w-10 text-blue-600 dark:text-blue-400" />
        </div>
        <div className="absolute -bottom-1 -right-1 w-8 h-8 rounded-full bg-gradient-to-r from-amber-400 to-orange-400 flex items-center justify-center shadow-lg">
          <Plus className="h-4 w-4 text-white" />
        </div>
      </div>
      
      {/* CTA Header */}
      <div className="mb-8">
        <h2 className="text-2xl font-semibold text-gray-900 dark:text-gray-100 mb-3">
          {t('Rejoignez un groupe ou créez le vôtre')}
        </h2>

      </div>

      {/* Action Buttons */}
      <div className="flex flex-col sm:flex-row gap-4 mb-10">
        <Button
          onClick={() => openGroupDialog('join')}
          className="px-8 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-full shadow-md hover:shadow-lg transition-all duration-200 font-medium"
        >
          <Search className="h-4 w-4 mr-2" />
          {t('Explorer les groupes')}
        </Button>
        <Button
          onClick={() => openGroupDialog('create')}
          variant="outline"
          className="px-8 py-2 border-2 border-gray-200 hover:border-amber-300 hover:bg-amber-50 dark:border-gray-700 dark:hover:border-amber-400 dark:hover:bg-amber-950/20 rounded-full shadow-sm hover:shadow-md transition-all duration-200 font-medium"
        >
          <PlusCircle className="h-4 w-4 mr-2" />
          {t('Créer un groupe')}
        </Button>
      </div>

      {/* Popular Groups Section (Simplified) */}
      {recommendedGroups.length > 0 && (
        <div className="w-full max-w-lg">
          <div className="flex items-center justify-center gap-2 mb-4">
            <div className="w-6 h-6 rounded-full bg-gradient-to-r from-amber-400 to-orange-400 flex items-center justify-center">
              <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-white">
                <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"></polygon>
              </svg>
            </div>
            <h3 className="text-lg font-medium text-gray-800 dark:text-gray-200">
              {t('Groupes populaires')}
            </h3>
          </div>

          {isLoadingRecommendations ? (
            <div className="flex justify-center py-6">
              <Loader2 className="h-6 w-6 animate-spin text-blue-500" />
            </div>
          ) : (
            <div className="space-y-2">
              {recommendedGroups.slice(0, 3).map(group => (
                <div
                  key={group.id}
                  onClick={() => {
                    if (group.is_publicly_joinable) {
                      handleDirectJoin(Number(group.id));
                    } else {
                      setSelectedAvailableGroup(group);
                    }
                  }}
                  className="flex items-center justify-between p-3 rounded-xl bg-white/50 dark:bg-gray-800/50 border border-gray-200/60 dark:border-gray-700/60 hover:bg-white dark:hover:bg-gray-800 hover:shadow-md transition-all duration-200 cursor-pointer group"
                >
                  <div className="flex items-center gap-3 min-w-0 flex-1">
                    <div className="w-10 h-10 rounded-full bg-gradient-to-br from-blue-100 to-purple-100 dark:from-blue-950/40 dark:to-purple-950/40 flex items-center justify-center flex-shrink-0">
                      {(() => {
                        const emoji = extractEmoji(group.name);
                        return emoji ? (
                          <span className="text-lg">{emoji}</span>
                        ) : (
                          <Building className="h-5 w-5 text-blue-600 dark:text-blue-400" />
                        );
                      })()}
                    </div>
                    <div className="min-w-0 text-left">
                      <p className="font-medium text-gray-900 dark:text-gray-100 truncate text-sm">
                        {(() => {
                          const emoji = extractEmoji(group.name);
                          return emoji ? group.name.replace(emoji, '').trim() : group.name;
                        })()}
                      </p>
                      <p className="text-xs text-gray-500 dark:text-gray-400 flex items-center gap-1">
                        <Users className="h-3 w-3" />
                        {group.memberCount || 0} {t('membres')}
                      </p>
                    </div>
                  </div>
                  <ChevronRight className="h-4 w-4 text-gray-400 group-hover:text-blue-500 group-hover:translate-x-1 transition-all duration-200" />
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );

  const renderGroupDialog = () => (
    <Dialog open={isGroupDialogOpen} onOpenChange={setIsGroupDialogOpen}>
      <DialogContent 
        className={cn(
          "sm:max-w-[500px] p-0 overflow-hidden flex flex-col",
          isLoadingRecommendations && "opacity-60 pointer-events-none"
        )}
        fullScreenOnMobile={true}
      >
        <div>
          <DialogHeader className="sticky top-0 z-10 bg-background border-b p-3 pb-2 relative">
            <DialogTitle className="text-lg font-semibold">{t('Gérer les salles de jeux')}</DialogTitle>
            <Button
              type="button"
              variant="ghost"
              size="icon"
              onClick={() => setIsGroupDialogOpen(false)}
              className="absolute right-4 top-1/2 -translate-y-1/2 h-8 w-8 rounded-full hover:bg-muted/80"
            >
              <X className="h-4 w-4" />
            </Button>
          </DialogHeader>
          
          <div className="p-3">
            <Tabs 
              value={groupDialogTab} 
              onValueChange={(value: string) => setGroupDialogTab(value as 'join' | 'create')}
            >
              <TabsList className={cn(
                "w-full grid grid-cols-2 mb-4"
              )}>
                <TabsTrigger value="join">{t('Rejoindre')}</TabsTrigger>
                <TabsTrigger value="create">{t('Créer')}</TabsTrigger>
              </TabsList>
              
              <TabsContent 
                value="join" 
                className="mt-0 space-y-4"
              >
                <div className="relative">
                  <div className="relative group">
                    <div className="absolute inset-0 bg-primary/5 rounded-lg blur-sm group-focus-within:bg-primary/10 transition-all duration-300 group-hover:bg-primary/7"></div>
                    <Input
                      type="text"
                      placeholder={t('Rechercher')}
                      className={cn(
                        "w-full rounded-md border border-input bg-background px-3 py-2 pl-10 text-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring relative",
                        noZoomInputClass
                      )}
                      value={searchTerm}
                      onChange={(e) => setSearchTerm(e.target.value)}
                    />
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    {searchTerm && (
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        className="absolute right-1 top-1/2 -translate-y-1/2 h-7 w-7 text-muted-foreground hover:text-foreground"
                        onClick={() => setSearchTerm('')}
                      >
                        <XCircle className="h-4 w-4" />
                      </Button>
                    )}
                  </div>
                </div>
                
                {availableGroups.length === 0 ? (
                  <div className="py-8 text-center">
                    <div className="relative mx-auto w-32 h-32">
                      <div className="absolute inset-0 bg-muted rounded-lg overflow-hidden">
                        {/* Empty building/door illustration */}
                        <div className="absolute inset-x-4 top-4 bottom-4 bg-gradient-to-b from-background to-muted-foreground/5 rounded-t-lg border-2 border-muted-foreground/20">
                          <div className="absolute left-1/2 top-4 transform -translate-x-1/2 w-12 h-3 bg-muted-foreground/20 rounded-md"></div>
                          <div className="absolute left-1/2 top-10 transform -translate-x-1/2 w-8 h-8 rounded-full bg-muted-foreground/10 flex items-center justify-center">
                            <Users className="h-5 w-5 text-muted-foreground/40" />
                          </div>
                          <div className="absolute bottom-3 right-3 w-2 h-6 bg-muted-foreground/20 rounded-full"></div>
                        </div>
                      </div>
                    </div>
                    <h3 className="text-lg font-medium mt-4">{t('Aucune salle disponible')}</h3>
                    <p className="text-muted-foreground mt-2 max-w-md mx-auto">
                      {t('Vous êtes déjà membre de toutes les salles existantes.')}
                    </p>
                    <Button
                      variant="outline"
                      onClick={() => setGroupDialogTab('create')}
                      className="mt-4"
                    >
                      <Plus className="h-4 w-4 mr-2" />
                      {t('Créer une nouvelle salle')}
                    </Button>
                  </div>
                ) : (
                  <>
                    {/* Legend removed as requested */}
                    
                    <ScrollArea className="h-[400px]">
                      <div className="grid grid-cols-1 gap-3">
                        {[...availableGroups].sort((a, b) => {
                          // First prioritize groups with pending requests
                          if (pendingJoinRequests.includes(a.id) && !pendingJoinRequests.includes(b.id)) return -1;
                          if (!pendingJoinRequests.includes(a.id) && pendingJoinRequests.includes(b.id)) return 1;
                          
                          // Then sort by accessibility (open doors first)
                          if (a.is_publicly_joinable && !b.is_publicly_joinable) return -1;
                          if (!a.is_publicly_joinable && b.is_publicly_joinable) return 1;
                          
                          // Then by name
                          return a.name.localeCompare(b.name);
                        })
                          .filter(group => 
                            group.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                            (group.description && group.description.toLowerCase().includes(searchTerm.toLowerCase()))
                          )
                          .map(group => (
                            <GroupCard
                              key={group.id}
                              id={group.id}
                              name={group.name}
                              description={group.description || (group.is_publicly_joinable ? t('Accès libre') : t('Sur candidature uniquement'))}
                              isLocked={!group.is_publicly_joinable}
                              isPending={pendingJoinRequests.includes(group.id)}
                              showGuards={!group.is_publicly_joinable}
                              selected={selectedAvailableGroup?.id === group.id}
                              width="100%"
                              variant="simple"
                              memberCount={group.memberCount || 0}
                              onClick={(id: number | string) => {
                                if (pendingJoinRequests.includes(Number(id))) {
                                  toast.info(t('Votre demande est en attente'));
                                } else if (group.is_publicly_joinable) {
                                  handleDirectJoin(Number(id));
                                } else {
                                  setSelectedAvailableGroup(group);
                                }
                              }}
                            />
                          ))
                        }
                      </div>
                    </ScrollArea>
                  </>
                )}
              </TabsContent>
              
              <TabsContent 
                value="create"
                className="mt-0 space-y-4 px-3"
              >
                {userGroups.some(group => group.created_by === user?.id) ? (
                  <div className="py-8 text-center">
                    <div className="mx-auto w-16 h-16 rounded-full bg-amber-100 flex items-center justify-center mb-4">
                      <Building className="h-8 w-8 text-amber-600" />
                    </div>
                    <h3 className="text-base font-medium">{t('Vous avez déjà créé une salle')}</h3>
                    <p className="text-sm text-muted-foreground mt-2 max-w-md mx-auto">
                      {t('Vous ne pouvez créer qu\'une seule salle par utilisateur.')}
                    </p>
                  </div>
                ) : (
                  <form onSubmit={handleCreateGroup} className="space-y-4 py-2">
                    <div className="space-y-2">
                      <Label htmlFor="groupName" className="text-base font-medium">
                        {t('Nom')}
                      </Label>
                      <div className="relative flex items-center gap-3">
                        <div className="relative flex-1">
                          <Input
                            id="groupName"
                            className={cn(
                              "w-full rounded-md border-2 border-input bg-background px-3 py-2 text-sm shadow-sm transition-colors placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50",
                              groupNameStatus === 'available' ? 'border-green-500/50 focus-visible:border-green-500' : 
                              groupNameStatus === 'taken' ? 'border-red-500/50 focus-visible:border-red-500' : '',
                              noZoomInputClass
                            )}
                            value={newGroupName}
                            onChange={(e) => setNewGroupName(e.target.value.slice(0, 15))}
                            maxLength={15}
                            required
                          />
                          {groupNameStatus && (
                            <div className="absolute right-3 top-1/2 -translate-y-1/2 flex items-center gap-2">
                              {groupNameStatus === 'checking' && (
                                <Loader2 className="h-4 animate-spin text-muted-foreground" />
                              )}
                              {groupNameStatus === 'available' && (
                                <div className="flex items-center gap-1 text-green-500 text-xs bg-green-50 dark:bg-green-950/30 px-1.5 py-0.5 rounded-full">
                                  <CheckCircle2 className="h-3 w-3" />
                                  <span>{t('OK')}</span>
                                </div>
                              )}
                              {groupNameStatus === 'taken' && newGroupName.trim().length >= 15 && (
                                <div className="flex items-center gap-1 text-amber-600 text-xs bg-amber-50 dark:bg-amber-950/30 px-1.5 py-0.5 rounded-full">
                                  <XCircle className="h-3 w-3" />
                                  <span>{t('Limite')}</span>
                                </div>
                              )}
                              {groupNameStatus === 'taken' && newGroupName.trim().length < 15 && (
                                <div className="flex items-center gap-1 text-red-500 text-xs bg-red-50 dark:bg-red-950/30 px-1.5 py-0.5 rounded-full">
                                  <XCircle className="h-3 w-3" />
                                  <span>{t('Pris')}</span>
                                </div>
                              )}
                            </div>
                          )}
                        </div>
                        <div className="relative">
                          <span className="absolute -top-5 left-1/2 -translate-x-1/2 text-xs font-medium text-muted-foreground whitespace-nowrap overflow-visible px-1">
                            {t('Emoji requis')}
                          </span>
                          <Popover modal={true} open={showEmojiPicker} onOpenChange={(open) => {
                            setShowEmojiPicker(open);
                          }}>
                            <PopoverTrigger asChild>
                              <Button
                                id="groupEmoji"
                                type="button"
                                variant={selectedEmoji ? "default" : "outline"}
                                className={cn(
                                  "h-10 w-10 shrink-0 relative overflow-hidden shadow-md border-2",
                                  selectedEmoji ? "bg-amber-400/20 text-2xl border-amber-400" : "text-muted-foreground border-dashed border-amber-400 hover:border-amber-400 hover:text-amber-500"
                                )}
                                aria-label={selectedEmoji ? t('Émoji sélectionné') : t('Sélectionner un émoji (requis)')}
                              >
                                {selectedEmoji || <Smile className="h-5 w-5" />}
                              </Button>
                            </PopoverTrigger>
                            <PopoverContent className="w-full p-0" align="end">
                              <div className="w-[320px] h-[400px]">
                                <Suspense fallback={
                                  <div className="flex items-center justify-center h-full">
                                    <Loader2 className="h-6 w-6 animate-spin text-primary" />
                                  </div>
                                }>
                                  <EmojiPicker
                                    onEmojiClick={(emojiData) => {
                                      setSelectedEmoji(emojiData.emoji);
                                      setShowEmojiPicker(false);
                                    }}
                                    width="100%"
                                    height={400}
                                    emojiStyle={EmojiStyle.NATIVE}
                                    theme={Theme.LIGHT}
                                    searchPlaceholder={t('Rechercher un emoji...')}
                                    previewConfig={{
                                      showPreview: false
                                    }}
                                    lazyLoadEmojis={true}
                                    hiddenEmojis={['1f30d', '1f30e', '1f30f', '1f310']} // Exclude all earth/globe emojis
                                    categories={[
                                      {
                                        name: t("Suggestions"),
                                        category: Categories.SUGGESTED
                                      },
                                      {
                                        name: t("Smileys"),
                                        category: Categories.SMILEYS_PEOPLE
                                      },
                                      {
                                        name: t("Animaux"),
                                        category: Categories.ANIMALS_NATURE
                                      },
                                      {
                                        name: t("Nourriture"),
                                        category: Categories.FOOD_DRINK
                                      },
                                      {
                                        name: t("Activités"),
                                        category: Categories.ACTIVITIES
                                      },
                                      {
                                        name: t("Objets"),
                                        category: Categories.OBJECTS
                                      },
                                      {
                                        name: t("Symboles"),
                                        category: Categories.SYMBOLS
                                      },
                                      {
                                        name: t("Drapeaux"),
                                        category: Categories.FLAGS
                                      }
                                    ]}
                                    style={{
                                      '--epr-emoji-size': '20px'
                                    } as React.CSSProperties}
                                  />
                                </Suspense>
                              </div>
                            </PopoverContent>
                          </Popover>
                        </div>
                      </div>
                    </div>
                    
                    <div className="space-y-2">
                      <Label htmlFor="groupDescription" className="text-base font-medium">
                        {t('Description')}
                      </Label>
                      <textarea
                        id="groupDescription"
                        className={cn(
                          "w-full min-h-[80px] rounded-md border-2 border-input bg-background px-3 py-2 text-sm shadow-sm transition-colors placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50 resize-none",
                          noZoomInputClass
                        )}
                        value={newGroupDescription}
                        onChange={(e) => setNewGroupDescription(e.target.value.slice(0, 30))}
                        placeholder={t('Décrivez votre salle...')}
                        maxLength={30}
                        required
                      />
                      <div className="text-xs text-muted-foreground text-right mt-1">
                        {newGroupDescription.length}/30
                      </div>
                    </div>
                    
                    <GroupSettings
                      isPubliclyJoinable={isPubliclyJoinable}
                      setIsPubliclyJoinable={setIsPubliclyJoinable}
                    />
                    
                    <div className="flex justify-between gap-2 mt-6 pt-4 border-t">
                      <Button
                        type="button"
                        variant="ghost"
                        onClick={() => setIsGroupDialogOpen(false)}
                        className="text-muted-foreground hover:text-foreground transition-colors"
                      >
                        <XCircle className="h-4 w-4 mr-1.5" />
                        {t('Annuler')}
                      </Button>
                      
                      <Button 
                        type="submit"
                        variant="default"
                        className={cn(
                          "relative overflow-hidden transition-all shadow-md",
                          "bg-gradient-to-b from-amber-400 to-amber-500",
                          "border border-amber-500 hover:from-amber-300 hover:to-amber-400"
                        )}
                        disabled={!newGroupName.trim() || isCreatingGroup || groupNameStatus !== 'available' || !selectedEmoji || !newGroupDescription.trim()}
                      >
                        {isCreatingGroup ? (
                          <>
                            <Loader2 className="h-4 w-4 mr-1.5 animate-spin" />
                            {t('Création en cours...')}
                          </>
                        ) : (
                          <>
                            <DoorOpen className="h-4 w-4 mr-1.5" />
                            {t('Créer la salle')}
                          </>
                        )}
                      </Button>
                    </div>
                  </form>
                )}
              </TabsContent>
            </Tabs>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );

  const isGroupCreator = (group: Group) => {
    return group.created_by === user?.id;
  };

  const openEditGroupDialog = (group: Group) => {
    setGroupToEdit(group);
    setEditIsPubliclyJoinable(group.is_publicly_joinable || false);
    setEditGroupDescription(group.description || '');
    setIsEditGroupDialogOpen(true);
  };

  const handleUpdateGroup = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    
    if (!groupToEdit) return;
    
    try {
      setIsUpdatingGroup(true);
      
      if (!user) {
        toast.error(t("Vous devez être connecté pour modifier une salle"));
        return;
      }
      
      if (groupToEdit.created_by !== user.id) {
        toast.error(t("Vous n'êtes pas autorisé à modifier cette salle"));
        return;
      }
      
      const { error } = await supabase
        .from('Group')
        .update({
          is_publicly_joinable: editIsPubliclyJoinable,
          description: editGroupDescription.trim()
        })
        .eq('id', groupToEdit.id);
      
      if (error) throw error;
      
      const updatedGroups = userGroups.map(group => 
        group.id === groupToEdit.id 
          ? { 
              ...group,
              is_publicly_joinable: editIsPubliclyJoinable,
              description: editGroupDescription.trim()
            } 
          : group
      );
      
      setUserGroups(updatedGroups);
      
      toast.success(t("Salle modifiée avec succès"));
      setIsEditGroupDialogOpen(false);
    } catch (error) {
      console.error('Error updating group:', error);
      toast.error(t("Erreur lors de la modification de la salle"));
    } finally {
      setIsUpdatingGroup(false);
    }
  };

  const handleDeleteGroup = async (group: Group) => {
    try {
      const { error } = await supabase
        .from('Group')
        .delete()
        .eq('id', group.id);
      
      if (error) throw error;
      
      // Remove the group from local state
      setUserGroups(userGroups.filter(g => g.id !== group.id));
      
      // If this was the selected group, select another one if available
      if (currentGroupId === group.id) {
        const remainingGroups = userGroups.filter(g => g.id !== group.id);
        setCurrentGroupId(remainingGroups.length > 0 ? remainingGroups[0].id : null);
      }
      
      toast.success(t("Salle supprimée avec succès"));
      setIsDeleteConfirmationOpen(false);
      setGroupToDelete(null);
    } catch (error) {
      console.error('Error deleting group:', error);
      toast.error(t("Erreur lors de la suppression de la salle"));
    }
  };

  const openDeleteConfirmationDialog = (group: Group) => {
    setGroupToDelete(group);
    setIsDeleteConfirmationOpen(true);
  };

  const renderDeleteConfirmationDialog = () => (
    <Dialog open={isDeleteConfirmationOpen} onOpenChange={setIsDeleteConfirmationOpen}>
      <DialogContent className="sm:max-w-[500px] p-0 gap-0 overflow-hidden bg-white/95 dark:bg-gray-900/95 backdrop-blur-xl border border-white/20" fullScreenOnMobile={false}>
        <motion.div 
          className="flex flex-col h-full"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3 }}
        >
          <DialogHeader className="sticky top-0 z-10 bg-gradient-to-b from-background/95 to-background/80 backdrop-blur-sm border-b border-white/10 p-6 pb-4 relative">
            <DialogTitle className="flex items-center gap-3 text-center justify-center text-xl">
              <motion.div
                initial={{ rotate: -10, scale: 0.8 }}
                animate={{ rotate: 0, scale: 1 }}
                transition={{ type: "spring", duration: 0.5 }}
              >
                <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="h-6 w-6 text-red-500">
                  <path d="M3 6h18" />
                  <path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6" />
                  <path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2" />
                </svg>
              </motion.div>
              <span className="bg-gradient-to-r from-red-600 to-red-700 bg-clip-text text-transparent font-bold">
                {t('Supprimer la salle')}
              </span>
            </DialogTitle>
          </DialogHeader>
          
          <motion.div 
            className="p-6 flex-1 flex flex-col justify-center space-y-6"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1, duration: 0.3 }}
          >
            <div className="bg-gradient-to-r from-red-50/80 to-red-100/60 dark:from-red-900/20 dark:to-red-800/20 text-red-800 dark:text-red-200 p-4 rounded-xl border border-red-200/50 dark:border-red-700/30 shadow-sm backdrop-blur-sm">
              <p className="text-sm leading-relaxed">
                {t('Supprimer définitivement la salle')} <span className="font-semibold">
                  <span className="text-base">{groupToDelete?.name?.match(/^[\u{1F300}-\u{1F9FF}]|^[\u{2600}-\u{26FF}]|^[\u{2700}-\u{27BF}]/u)?.[0] || ''}</span>
                  <span className="text-red-900 dark:text-red-100">{groupToDelete?.name?.replace(/^[\u{1F300}-\u{1F9FF}]|^[\u{2600}-\u{26FF}]|^[\u{2700}-\u{27BF}]\s*/u, '') || groupToDelete?.name}</span>
                </span> {t('et tout ses paris ?')}
              </p>
            </div>
            <motion.div 
              className="flex justify-end gap-3 mt-auto"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.2, duration: 0.3 }}
            >
              <Button
                variant="outline"
                onClick={() => {
                  setIsDeleteConfirmationOpen(false);
                  setGroupToDelete(null);
                }}
                className="border-gray-200/60 dark:border-gray-700/60 bg-white/50 dark:bg-gray-800/50 backdrop-blur-sm hover:bg-white/80 dark:hover:bg-gray-700/80 shadow-sm hover:shadow-md transition-all duration-200"
              >
                {t('Annuler')}
              </Button>
              <Button
                variant="destructive"
                onClick={() => {
                  if (groupToDelete) {
                    handleDeleteGroup(groupToDelete);
                  }
                }}
                className="gap-2 bg-gradient-to-r from-red-500 to-red-600 hover:from-red-600 hover:to-red-700 shadow-sm hover:shadow-lg transition-all duration-200 backdrop-blur-sm"
              >
                <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M3 6h18" />
                  <path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6" />
                  <path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2" />
                </svg>
                {t('Supprimer')}
              </Button>
            </motion.div>
          </motion.div>
        </motion.div>
      </DialogContent>
    </Dialog>
  );

  const renderEditGroupDialog = () => (
    <Dialog open={isEditGroupDialogOpen} onOpenChange={setIsEditGroupDialogOpen}>
      <DialogContent className="sm:max-w-[500px] p-0 gap-0 flex flex-col overflow-hidden bg-white/95 dark:bg-gray-900/95 backdrop-blur-xl border border-white/20" fullScreenOnMobile={true}>
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3 }}
        >
          <DialogHeader className="sticky top-0 z-10 bg-gradient-to-b from-background/95 to-background/80 backdrop-blur-sm border-b border-white/10 p-6 pb-4 relative">
            <DialogTitle className="flex items-center gap-3 text-center justify-center text-xl">
              <motion.div
                initial={{ rotate: -10, scale: 0.8 }}
                animate={{ rotate: 0, scale: 1 }}
                transition={{ type: "spring", duration: 0.5 }}
              >
                <Building className={`h-6 w-6 ${editIsPubliclyJoinable ? 'text-green-500' : 'text-orange-500'}`} />
              </motion.div>
              <div className="flex items-center gap-1 truncate max-w-[calc(100%-3rem)]">
                {/* Extract emoji from name if it starts with one */}
                <span className="text-xl">
                  {groupToEdit?.name?.match(/^[\u{1F300}-\u{1F9FF}]|^[\u{2600}-\u{26FF}]|^[\u{2700}-\u{27BF}]/u)?.[0] || ''}
                </span>
                <span className={`${editIsPubliclyJoinable ? 'bg-gradient-to-r from-green-600 to-green-700' : 'bg-gradient-to-r from-orange-600 to-orange-700'} bg-clip-text text-transparent font-bold`}>
                  {groupToEdit?.name?.replace(/^[\u{1F300}-\u{1F9FF}]|^[\u{2600}-\u{26FF}]|^[\u{2700}-\u{27BF}]\s*/u, '') || groupToEdit?.name}
                </span>
              </div>
            </DialogTitle>
          </DialogHeader>
          
          <motion.div 
            className="p-6"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1, duration: 0.3 }}
          >
            <form onSubmit={handleUpdateGroup} className="space-y-6">
              <div className="space-y-3">
                <h3 className={`text-sm font-semibold flex items-center gap-2 ${editIsPubliclyJoinable ? 'text-green-700 dark:text-green-300' : 'text-orange-700 dark:text-orange-300'}`}>
                  {t('Description de la salle')}
                </h3>
                <div className="relative">
                  <textarea
                    id="editGroupDescription"
                    className={cn(
                      `w-full min-h-[80px] rounded-xl border-2 ${editIsPubliclyJoinable ? 'border-green-200/50 dark:border-green-700/30 focus-visible:ring-green-500/50 focus-visible:border-green-400 hover:border-green-300/60' : 'border-orange-200/50 dark:border-orange-700/30 focus-visible:ring-orange-500/50 focus-visible:border-orange-400 hover:border-orange-300/60'} bg-white/50 dark:bg-gray-800/50 backdrop-blur-sm px-4 py-3 pb-6 text-sm shadow-sm transition-all placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 disabled:cursor-not-allowed disabled:opacity-50 resize-none hover:bg-white/70 dark:hover:bg-gray-700/60`,
                      noZoomInputClass
                    )}
                    value={editGroupDescription}
                    onChange={(e) => setEditGroupDescription(e.target.value.slice(0, 30))}
                    placeholder={t('Décrivez votre salle...')}
                    maxLength={30}
                    required
                  />
                  <div className={`absolute bottom-2 right-3 text-xs font-medium ${editIsPubliclyJoinable ? 'text-green-500/70' : 'text-orange-500/70'}`}>
                    {editGroupDescription.length}/30
                  </div>
                </div>
              </div>
              
              <GroupSettings
                isPubliclyJoinable={editIsPubliclyJoinable}
                setIsPubliclyJoinable={setEditIsPubliclyJoinable}
                isEditing={true}
              />
              <motion.div 
                className="flex justify-between gap-3 pt-4"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.2, duration: 0.3 }}
              >
                <Button
                  type="button"
                  variant="destructive"
                  onClick={() => {
                    if (groupToEdit) {
                      setIsEditGroupDialogOpen(false);
                      openDeleteConfirmationDialog(groupToEdit);
                    }
                  }}
                  className="gap-2 bg-gradient-to-r from-red-500 to-red-600 hover:from-red-600 hover:to-red-700 shadow-sm hover:shadow-lg transition-all duration-200 backdrop-blur-sm"
                >
                  <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M3 6h18" />
                    <path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6" />
                    <path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2" />
                  </svg>
                  
                </Button>

                <div className="flex gap-3">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => setIsEditGroupDialogOpen(false)}
                    className="border-gray-200/60 dark:border-gray-700/60 bg-white/50 dark:bg-gray-800/50 backdrop-blur-sm hover:bg-white/80 dark:hover:bg-gray-700/80 shadow-sm hover:shadow-md transition-all duration-200"
                  >
                    <X className="h-4 w-4 mr-2" />
                    {t('Annuler')}
                  </Button>
                  
                  <Button 
                    type="submit"
                    disabled={isUpdatingGroup || !editGroupDescription.trim()}
                    className={`gap-2 shadow-sm hover:shadow-lg transition-all duration-200 backdrop-blur-sm ${editIsPubliclyJoinable ? 'bg-gradient-to-r from-green-500 to-green-600 hover:from-green-600 hover:to-green-700' : 'bg-gradient-to-r from-orange-500 to-orange-600 hover:from-orange-600 hover:to-orange-700'}`}
                  >
                    {isUpdatingGroup ? (
                      <>
                        <Loader2 className="h-4 w-4 animate-spin" />
                        {t('Mise à jour...')}
                      </>
                    ) : (
                      <>
                        <CheckCircle2 className="h-4 w-4" />
                        {t('Enregistrer')}
                      </>
                    )}
                  </Button>
                </div>
              </motion.div>
            </form>
          </motion.div>
        </motion.div>
      </DialogContent>
    </Dialog>
  );

  const renderMembersDialog = () => {
    const selectedGroup = userGroups.find(g => g.id === selectedGroupForMembers);
    const groupName = selectedGroup?.name || '';
    const groupEmoji = groupName.match(/^[\u{1F300}-\u{1F9FF}]|^[\u{2600}-\u{26FF}]|^[\u{2700}-\u{27BF}]/u)?.[0] || '';
    const groupDisplayName = groupName.replace(/^[\u{1F300}-\u{1F9FF}]|^[\u{2600}-\u{26FF}]|^[\u{2700}-\u{27BF}]\s*/u, '') || groupName;
    
    return (
      <Dialog open={!!selectedGroupForMembers} onOpenChange={(open) => {
        if (!open) {
          setSelectedGroupForMembers(null);
          setMemberSearchQuery('');
        }
      }}>
        <DialogContent className="sm:max-w-[500px] sm:max-h-[90vh] p-0 gap-0 flex flex-col overflow-hidden bg-white/95 dark:bg-gray-900/95 backdrop-blur-xl border border-white/20" fullScreenOnMobile={true}>
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.3 }}
            className="flex flex-col max-h-[90vh] sm:max-h-[80vh]"
          >
            <DialogHeader className="sticky top-0 z-10 bg-gradient-to-b from-background/95 to-background/80 backdrop-blur-sm border-b border-white/10 p-6 pb-4 relative flex-shrink-0">
              <DialogTitle className="flex items-center gap-3 text-center justify-center text-xl">
                <motion.div
                  initial={{ rotate: -10, scale: 0.8 }}
                  animate={{ rotate: 0, scale: 1 }}
                  transition={{ type: "spring", duration: 0.5 }}
                >
                  <Users className="h-6 w-6 text-primary" />
                </motion.div>
                <div className="flex items-center gap-1 truncate max-w-[calc(100%-3rem)]">
                  {groupEmoji && <span className="text-xl">{groupEmoji}</span>}
                  <span className="bg-gradient-to-r from-primary to-primary/80 bg-clip-text text-transparent font-bold">
                    {groupDisplayName}
                  </span>
                </div>
              </DialogTitle>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                onClick={() => setSelectedGroupForMembers(null)}
                className="absolute right-4 top-1/2 -translate-y-1/2 h-8 w-8 rounded-full hover:bg-muted/80"
              >
                <X className="h-4 w-4" />
              </Button>
            </DialogHeader>
          
            <motion.div 
              className="overflow-y-auto flex-1"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.1, duration: 0.3 }}
            >
              <div className="p-6">
                {isLoadingMembers ? (
                  <div className="flex justify-center items-center py-8">
                    <div className="flex flex-col items-center gap-3">
                      <Loader2 className="h-8 w-8 animate-spin text-primary" />
                      <p className="text-sm text-muted-foreground">{t('Chargement des membres...')}</p>
                    </div>
                  </div>
                ) : (
                  <div className="space-y-6">
                    {/* Share Link Section */}
                    <motion.div 
                      className="bg-gradient-to-r from-blue-50/50 to-indigo-50/50 dark:from-blue-950/20 dark:to-indigo-950/20 border border-blue-200/30 dark:border-blue-700/30 rounded-xl p-4 shadow-sm"
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: 0.2, duration: 0.3 }}
                    >
                      <div className="text-center">
                        <Button
                          onClick={() => selectedGroup && handleShareGroup(selectedGroup)}
                          className="gap-2 bg-blue-500 hover:bg-blue-600 text-white shadow-sm hover:shadow-md transition-all px-6 py-2.5 rounded-lg"
                        >
                          <Share2 className="h-4 w-4" />
                          <span className="font-medium">{t('Partager le lien d\'invitation')}</span>
                        </Button>
                      </div>
                    </motion.div>

                    {/* Enhanced Add Members Section */}
                    <motion.div 
                      className="bg-gradient-to-r from-green-50/50 to-emerald-50/50 dark:from-green-950/20 dark:to-emerald-950/20 border border-green-200/30 dark:border-green-700/30 rounded-xl p-4 shadow-sm"
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: 0.25, duration: 0.3 }}
                    >
                      <div className="flex items-center gap-3 mb-3">
                        <div className="bg-green-100 dark:bg-green-900/30 p-2 rounded-full">
                          <UserPlus className="h-5 w-5 text-green-600 dark:text-green-400" />
                        </div>
                        <h3 className="text-sm font-semibold text-green-700 dark:text-green-300">
                          {t('Ajouter des utilisateurs')}
                        </h3>
                      </div>
                      
                      <div className="relative">
                        <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                          <Search className="h-4 w-4 text-muted-foreground" />
                        </div>
                        <Input
                          placeholder={t('Rechercher des utilisateurs...')}
                          value={userSearchQuery}
                          onChange={(e) => {
                            setUserSearchQuery(e.target.value);
                            if (e.target.value.trim()) {
                              searchUsers(selectedGroupForMembers!);
                            } else {
                              setSearchResults([]);
                            }
                          }}
                          className="pl-10 pr-10 w-full transition-all duration-200 focus-visible:ring-1 focus-visible:ring-green-500/50 border-green-200/50 shadow-sm bg-white/80 dark:bg-gray-800/80 rounded-lg"
                        />
                        {userSearchQuery ? (
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => {
                              setUserSearchQuery('');
                              setSearchResults([]);
                            }}
                            className="absolute right-1 top-1/2 -translate-y-1/2 h-7 w-7 rounded-full hover:bg-muted/80"
                          >
                            <X className="h-3.5 w-3.5" />
                          </Button>
                        ) : (
                          <Users className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                        )}
                      </div>
                      
                      {/* Search results with animation */}
                      {userSearchQuery && (
                        <motion.div 
                          className="mt-3 rounded-lg overflow-hidden shadow-sm border border-green-200/30 dark:border-green-700/30 bg-white/80 dark:bg-gray-800/80"
                          initial={{ opacity: 0, height: 0 }}
                          animate={{ opacity: 1, height: "auto" }}
                          exit={{ opacity: 0, height: 0 }}
                        >
                          {isLoadingUsers ? (
                            <div className="p-4 text-center text-sm text-muted-foreground">
                              <Loader2 className="h-4 w-4 animate-spin mx-auto mb-2" />
                              {t('Recherche en cours...')}
                            </div>
                          ) : searchResults.length > 0 ? (
                            <div className="max-h-[250px] overflow-y-auto">
                              {searchResults
                                .filter(user => user.username?.toLowerCase().includes(userSearchQuery.toLowerCase()))
                                .map((user, index) => (
                                <div 
                                  key={user.id} 
                                  className={cn(
                                    "flex items-center justify-between p-3 hover:bg-green-50/50 dark:hover:bg-green-900/20 transition-colors",
                                    index !== searchResults.length - 1 && "border-b border-green-100/50 dark:border-green-800/50"
                                  )}
                                >
                                  <div className="flex items-center gap-3 min-w-0 flex-1">
                                    <Avatar className="h-8 w-8 border-2 border-green-200/50 shadow-sm flex-shrink-0">
                                      <AvatarFallback className="bg-green-100 dark:bg-green-900/50 text-green-600 dark:text-green-400 text-xs font-medium">
                                        {user.username?.substring(0, 2).toUpperCase()}
                                      </AvatarFallback>
                                    </Avatar>
                                    <p className="font-medium text-sm truncate">{user.username}</p>
                                  </div>
                                  <Button
                                    size="sm"
                                    onClick={() => handleAddMember(user.id)}
                                    className="h-7 gap-1 bg-green-500 hover:bg-green-600 text-white shadow-sm hover:shadow transition-all flex-shrink-0"
                                  >
                                    <Plus className="h-3 w-3" />
                                    <span className="text-xs">{t('Ajouter')}</span>
                                  </Button>
                                </div>
                              ))}
                            </div>
                          ) : (
                            <div className="p-4 text-center text-sm text-muted-foreground">
                              {t('Aucun utilisateur trouvé')}
                            </div>
                          )}
                        </motion.div>
                      )}
                    </motion.div>
                    
                    {/* Members List Section */}
                    <motion.div
                      className="bg-gradient-to-r from-slate-50/50 to-gray-50/50 dark:from-slate-950/20 dark:to-gray-950/20 border border-slate-200/30 dark:border-slate-700/30 rounded-xl p-2 shadow-sm"
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: 0.3, duration: 0.3 }}
                    >
                      <div className="flex items-center justify-between mb-3">
                        <div className="flex items-center gap-3">
                          <div className="bg-slate-100 dark:bg-slate-900/30 p-2 rounded-full">
                            <Users className="h-5 w-5 text-slate-600 dark:text-slate-400" />
                          </div>
                          <h3 className="text-sm font-semibold text-slate-700 dark:text-slate-300">{t('Membres actuels')}</h3>
                        </div>
                        <div className="bg-slate-200/50 dark:bg-slate-800/50 text-xs font-medium px-3 py-1 rounded-full text-slate-600 dark:text-slate-400">
                          {groupMembers.filter(member => 
                            member.username?.toLowerCase().includes(memberSearchQuery.toLowerCase()) || 
                            member.email?.toLowerCase().includes(memberSearchQuery.toLowerCase())
                          ).length} {groupMembers.filter(member => 
                            member.username?.toLowerCase().includes(memberSearchQuery.toLowerCase()) || 
                            member.email?.toLowerCase().includes(memberSearchQuery.toLowerCase())
                          ).length > 1 ? t('membres') : t('membre')}
                        </div>
                      </div>
                      
                      {/* Search bar for members */}
                      <div className="relative mb-3">
                        <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                          <Search className="h-4 w-4 text-slate-400" />
                        </div>
                        <Input
                          placeholder={t('Rechercher dans les membres...')}
                          value={memberSearchQuery}
                          onChange={(e) => setMemberSearchQuery(e.target.value)}
                          className="pl-10 pr-10 w-full text-sm border-slate-200/50 dark:border-slate-700/50 bg-white/80 dark:bg-gray-800/80 rounded-lg focus-visible:ring-1 focus-visible:ring-slate-400/50"
                        />
                        {memberSearchQuery ? (
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => setMemberSearchQuery('')}
                            className="absolute right-1 top-1/2 -translate-y-1/2 h-7 w-7 rounded-full hover:bg-muted/80"
                          >
                            <X className="h-3.5 w-3.5" />
                          </Button>
                        ) : (
                          <Users className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                        )}
                      </div>
                      
                      <div className="rounded-xl border border-slate-200/40 dark:border-slate-700/40 shadow-sm overflow-hidden bg-white/60 dark:bg-gray-800/60">
                        <ScrollArea className="h-[200px] sm:h-[220px]">
                          <div className="p-1">
                            {[...groupMembers]
                              .filter(member => 
                                member.username?.toLowerCase().includes(memberSearchQuery.toLowerCase()) || 
                                member.email?.toLowerCase().includes(memberSearchQuery.toLowerCase())
                              )
                              .sort((a, b) => {
                                return (a.username || '').localeCompare(b.username || '');
                              }).map((member) => (
                              <div 
                                key={member.id} 
                                className={cn(
                                  "py-3 px-3 flex items-center justify-between transition-all duration-200 hover:bg-slate-50/70 dark:hover:bg-slate-800/50 rounded-lg mx-1 my-0.5",
                                  member.id === user?.id && "bg-blue-50/50 dark:bg-blue-950/20 border border-blue-200/30 dark:border-blue-800/30"
                                )}
                              >
                                <div className="flex items-center gap-3 min-w-0 flex-1">
                                  <Avatar className="h-9 w-9 border-2 border-white dark:border-gray-700 shadow-sm flex-shrink-0">
                                    {member.avatar_url ? (
                                      <Image 
                                        src={member.avatar_url || ''}
                                        alt={member.username || member.email || 'User'}
                                        className="w-full h-full object-cover"
                                        width={36}
                                        height={36}
                                      />
                                    ) : (
                                      <AvatarFallback className="bg-gradient-to-br from-blue-100 to-indigo-100 dark:from-blue-900/50 dark:to-indigo-900/50 text-blue-600 dark:text-blue-400 text-sm font-medium">
                                        {member.username?.substring(0, 2).toUpperCase()}
                                      </AvatarFallback>
                                    )}
                                  </Avatar>
                                  <div className="min-w-0">
                                    <p className="font-medium text-sm truncate text-slate-700 dark:text-slate-300">
                                      {member.username || 'Utilisateur'}
                                    </p>
                                    {member.id === user?.id && (
                                      <span className="text-[10px] bg-blue-100 dark:bg-blue-900/50 text-blue-600 dark:text-blue-400 px-2 py-0.5 rounded-full font-medium">
                                        {t('Vous')}
                                      </span>
                                    )}
                                  </div>
                                </div>
                                
                                {member.id !== user?.id && selectedGroupForMembers && isGroupCreator(userGroups.find(g => g.id === selectedGroupForMembers) as Group) && (
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    onClick={() => handleKickMember(selectedGroupForMembers!, member.id)}
                                    className="h-8 gap-1 text-red-500 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-950/20 transition-colors flex-shrink-0 rounded-lg"
                                  >
                                    <X className="h-3 w-3" />
                                    <span className="text-xs">{t('Exclure')}</span>
                                  </Button>
                                )}
                              </div>
                            ))}
                          </div>
                        </ScrollArea>
                      </div>
                    </motion.div>
                  </div>
                )}
              </div>
            </motion.div>
          </motion.div>
        </DialogContent>
      </Dialog>
    );
  };

  const searchUsers = async (groupId?: number) => {
    try {
      // Use the passed groupId parameter or fall back to the state value
      const targetGroupId = groupId || selectedGroupForMembers;
      
      if (!targetGroupId) return;
      
      setIsLoadingUsers(true);
      
      // First get all members of the selected group
      const { data: memberships, error: membershipError } = await supabase
        .from('UsersGroupMembership')
        .select('user')
        .eq('group', targetGroupId);
      
      if (membershipError) throw membershipError;
      
      // Get the IDs of users already in the group
      const existingMemberIds = memberships?.map(m => m.user) || [];
      
      // Query all users excluding those already in the group
      const { data, error } = await supabase
        .from('Users')
        .select('id, username, bio, is_banned');

      if (error) throw error;
      
      // Filter out users who are already members of the group
      const filteredUsers = data?.filter(user => !existingMemberIds.includes(user.id)) || [];
      
      setSearchResults(filteredUsers);
      console.log('Fetched users count:', data?.length, 'Filtered users count:', filteredUsers.length);
    } catch (error) {
      console.error('Error searching users:', error);
        toast.error(t('Erreur lors de la recherche des utilisateurs'));
    } finally {
      setIsLoadingUsers(false);
    }
  };

  const handleAddMember = async (userId: string) => {
    if (!selectedGroupForMembers) return;
    
    try {
      // Get user details from search results
      const userToAdd = searchResults.find(user => user.id === userId);
      
      if (!userToAdd) {
        toast.error(t("Utilisateur introuvable"));
        return;
      }
      
      // Optimistically update the UI
      setGroupMembers(prevMembers => [...prevMembers, userToAdd]);
      
      // Update the memberCount in userGroups
      setUserGroups(prevGroups => prevGroups.map(group => 
        group.id === selectedGroupForMembers 
          ? { ...group, memberCount: (group.memberCount || 0) + 1 }
          : group
      ));
      
      // Remove from search results optimistically
      setSearchResults(prevResults => prevResults.filter(user => user.id !== userId));
      
      // Perform the actual operation in the background
      const { error } = await supabase
        .from('UsersGroupMembership')
        .insert({
          user: userId,
          group: selectedGroupForMembers
        });
      
      if (error) throw error;
      
      // Check if user already has points in this group - still do this in the background
      const { data: existingPoints, error: pointsCheckError } = await supabase
        .from('PointsHistory')
        .select('id')
        .eq('user', userId)
        .eq('group', selectedGroupForMembers)
        .limit(1);
        
      if (pointsCheckError) {
        console.error('Error checking existing points:', pointsCheckError);
      }
      
      // If no existing points record, add initial 200 points
      if (!existingPoints || existingPoints.length === 0) {
        const { error: addPointsError } = await supabase
          .from('PointsHistory')
          .insert({
            user: userId,
            group: selectedGroupForMembers,
            amount: 200,
            timestamp: new Date().toISOString()
          });
          
        if (addPointsError) {
          console.error('Error adding initial points:', addPointsError);
        } else {
          console.log('Added 200 initial points to user in group', selectedGroupForMembers);
        }
      }
      
      toast.success(t("Membre ajouté avec succès"));
    } catch (error) {
      console.error('Error adding member:', error);
      toast.error(t("Erreur lors de l'ajout du membre"));
      
      // If there was an error, refresh the data to restore the correct state
      if (selectedGroupForMembers) {
        fetchGroupMembers(selectedGroupForMembers);
        searchUsers(selectedGroupForMembers);
      }
    }
  };

  const openLeaveConfirmationDialog = (group: Group) => {
    setGroupToLeave(group);
    setIsLeaveConfirmationOpen(true);
  };

  const handleLeaveGroup = async (groupId: number) => {
    try {
      const { error } = await supabase
        .from('UsersGroupMembership')
        .delete()
        .eq('user', user.id)
        .eq('group', groupId);
      
      if (error) throw error;
      
      // Remove the group from local state
      setUserGroups(userGroups.filter(g => g.id !== groupId));
      
      // If this was the selected group, select another one if available
      if (currentGroupId === groupId) {
        const remainingGroups = userGroups.filter(g => g.id !== groupId);
        setCurrentGroupId(remainingGroups.length > 0 ? remainingGroups[0].id : null);
      }
      
      toast.success(t("Vous avez quitté la salle"));
      setIsGroupDialogOpen(false);
      setIsLeaveConfirmationOpen(false);
    } catch (error) {
      console.error('Error leaving group:', error);
      toast.error(t("Erreur lors de la tentative de quitter la salle"));
    }
  };

  const handleShareGroup = async (group: Group) => {
    try {
      const shareUrl = `${window.location.origin}/join-group/${group.id}`;
      
      // Try to use the modern clipboard API first
      if (navigator.clipboard && window.isSecureContext) {
        await navigator.clipboard.writeText(shareUrl);
      } else {
        // Fallback for older browsers or non-secure contexts
        const textArea = document.createElement('textarea');
        textArea.value = shareUrl;
        textArea.style.position = 'fixed';
        textArea.style.left = '-999999px';
        textArea.style.top = '-999999px';
        document.body.appendChild(textArea);
        textArea.focus();
        textArea.select();
        document.execCommand('copy');
        textArea.remove();
      }
      
      toast.success(t("Lien de partage copié dans le presse-papiers"));
    } catch (error) {
      console.error('Error sharing group:', error);
      toast.error(t("Erreur lors de la copie du lien"));
    }
  };

  const renderLeaveConfirmationDialog = () => (
    <Dialog open={isLeaveConfirmationOpen} onOpenChange={setIsLeaveConfirmationOpen}>
      <DialogContent className="sm:max-w-[500px] p-0 gap-0 overflow-hidden bg-white/95 dark:bg-gray-900/95 backdrop-blur-xl border border-white/20" fullScreenOnMobile={false}>
        <motion.div 
          className="flex flex-col h-full"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3 }}
        >
          <DialogHeader className="sticky top-0 z-10 bg-gradient-to-b from-background/95 to-background/80 backdrop-blur-sm border-b border-white/10 p-6 pb-4 relative">
            <DialogTitle className="flex items-center gap-3 text-center justify-center text-xl">
              <motion.div
                initial={{ rotate: -10, scale: 0.8 }}
                animate={{ rotate: 0, scale: 1 }}
                transition={{ type: "spring", duration: 0.5 }}
              >
                <DoorOpen className="h-6 w-6 text-red-500" />
              </motion.div>
              <span className="bg-gradient-to-r from-red-600 to-red-700 bg-clip-text text-transparent font-bold">
                {t('Quitter la salle')}
              </span>
            </DialogTitle>
          </DialogHeader>
          
          <motion.div 
            className="p-6 flex-1 flex flex-col justify-center space-y-6"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1, duration: 0.3 }}
          >
            <div className="bg-gradient-to-r from-red-50/80 to-red-100/60 dark:from-red-900/20 dark:to-red-800/20 text-red-800 dark:text-red-200 p-4 rounded-xl border border-red-200/50 dark:border-red-700/30 shadow-sm backdrop-blur-sm">
              <p className="text-sm leading-relaxed">
                {t('Êtes-vous sûr de vouloir quitter')} <span className="font-semibold">
                  <span className="text-base">{groupToLeave?.name?.match(/^[\u{1F300}-\u{1F9FF}]|^[\u{2600}-\u{26FF}]|^[\u{2700}-\u{27BF}]/u)?.[0] || ''}</span>
                  <span className="text-red-900 dark:text-red-100">{groupToLeave?.name?.replace(/^[\u{1F300}-\u{1F9FF}]|^[\u{2600}-\u{26FF}]|^[\u{2700}-\u{27BF}]\s*/u, '') || groupToLeave?.name}</span>
                </span> {t('?')}
              </p>
            </div>
            <motion.div 
              className="flex justify-end gap-3 mt-auto"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.2, duration: 0.3 }}
            >
              <Button
                variant="outline"
                onClick={() => setIsLeaveConfirmationOpen(false)}
                className="border-gray-200/60 dark:border-gray-700/60 bg-white/50 dark:bg-gray-800/50 backdrop-blur-sm hover:bg-white/80 dark:hover:bg-gray-700/80 shadow-sm hover:shadow-md transition-all duration-200"
              >
                {t('Annuler')}
              </Button>
              <Button
                variant="destructive"
                onClick={() => {
                  if (groupToLeave) {
                    handleLeaveGroup(groupToLeave.id);
                  }
                }}
                className="gap-2 bg-gradient-to-r from-red-500 to-red-600 hover:from-red-600 hover:to-red-700 shadow-sm hover:shadow-lg transition-all duration-200 backdrop-blur-sm"
              >
                <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
                  <polyline points="16 17 21 12 16 7" />
                  <line x1="21" y1="12" x2="9" y2="12" />
                </svg>
                {t('Quitter')}
              </Button>
            </motion.div>
          </motion.div>
        </motion.div>
      </DialogContent>
    </Dialog>
  );




  const renderJoinRequestDialog = () => (
    <Dialog open={!!selectedAvailableGroup} onOpenChange={(open) => !open && setSelectedAvailableGroup(null)}>
      <DialogContent className="sm:max-w-[500px] p-0 gap-0 overflow-hidden bg-white/95 dark:bg-gray-900/95 backdrop-blur-xl border border-white/20">
        <motion.div 
          className="p-6"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3 }}
        >
          <DialogHeader className="mb-6">
            <DialogTitle className="flex items-center gap-3 text-center justify-center text-xl">
              <motion.div
                initial={{ rotate: -10 }}
                animate={{ rotate: 0 }}
                transition={{ type: "spring" }}
              >
                <Lock className="h-6 w-6 text-amber-500" />
              </motion.div>
              <span className="bg-gradient-to-r from-amber-600 to-orange-600 bg-clip-text text-transparent font-bold">
                {selectedAvailableGroup?.name || t("Salle privée")}
              </span>
            </DialogTitle>
          </DialogHeader>
          
          <motion.div 
            className="space-y-6"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.1 }}
          >
            <div className="rounded-xl overflow-hidden border border-white/20 shadow-lg focus-within:ring-2 focus-within:ring-amber-500/20 bg-white/50 dark:bg-gray-800/50 backdrop-blur-sm">
              <motion.textarea
                className={cn(
                  "w-full min-h-[120px] bg-transparent p-4 text-sm outline-none resize-none placeholder:text-muted-foreground",
                  noZoomInputClass
                )}
                placeholder={t('Expliquez pourquoi vous souhaitez rejoindre cette salle...')}
                value={joinRequestMessage}
                onChange={(e) => setJoinRequestMessage(e.target.value)}
                maxLength={99}
                initial={{ opacity: 0.7 }}
                whileFocus={{ opacity: 1 }}
              />
              <div className="px-4 py-2 text-xs text-muted-foreground bg-white/30 dark:bg-gray-700/30 text-right border-t border-white/20">
                {joinRequestMessage.length}/99
              </div>
            </div>
          </motion.div>
          
          <motion.div 
            className="flex gap-3 mt-6"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
          >
            <motion.div className="flex-1" whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }}>
              <Button
                variant="outline"
                onClick={() => setSelectedAvailableGroup(null)}
                className="w-full h-12 rounded-xl border-white/20 hover:bg-white/50 dark:hover:bg-gray-700/50"
                disabled={isJoinRequestSubmitting}
              >
                {t('Annuler')}
              </Button>
            </motion.div>
            <motion.div className="flex-1" whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }}>
              <Button
                disabled={isJoinRequestSubmitting || !joinRequestMessage.trim()}
                onClick={handleSubmitJoinRequest}
                className="w-full h-12 bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-600 hover:to-orange-600 text-white rounded-xl shadow-lg"
              >
                {isJoinRequestSubmitting ? (
                  <>
                    <motion.div
                      animate={{ rotate: 360 }}
                      transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
                      className="mr-2"
                    >
                      <Loader2 className="h-4 w-4" />
                    </motion.div>
                    {t('Envoi...')}
                  </>
                ) : (
                  <motion.div 
                    className="flex items-center gap-2"
                    whileHover={{ x: 2 }}
                  >
                    <MessageSquare className="h-4 w-4" />
                    {t('Envoyer')}
                  </motion.div>
                )}
              </Button>
            </motion.div>
          </motion.div>
        </motion.div>
      </DialogContent>
    </Dialog>
  );


  if (!hasLoaded) {
    return (
      <div className="mt-4">
        <div className="flex items-center gap-2 mb-6">
          <div className="h-5 w-5 rounded bg-muted animate-pulse"></div>
          <div className="h-7 w-48 bg-muted rounded animate-pulse"></div>
        </div>
        <div className="space-y-3">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-16 w-full bg-muted rounded-md animate-pulse" />
          ))}
        </div>
      </div>
    );
  }

  return (
    <>
      {currentGroupId && userGroups.length > 0 && (
        <div className="mb-4">
          <GroupSelector 
            groups={userGroups}
            currentGroupId={currentGroupId}
            setCurrentGroupId={setCurrentGroupId}
            openGroupDialog={openGroupDialog}
            extractEmoji={extractEmoji}
          />
        </div>
      )}
      
      {userGroups.length === 0 && renderNoGroupsMessage()}

      {/* Show list of groups when no group is selected */}
      {currentGroupId === null && userGroups.length > 0 && (
        <div className="mt-4 space-y-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <h2 className="text-xl font-semibold flex items-center gap-2 min-w-0">
              <Building className="h-5 w-5 flex-shrink-0 text-primary/70" />
              <span className="truncate">{t('Vos salles de jeux')}</span>
            </h2>
            {/* Buttons removed from here */}
          </div>
          
          {/* Owned groups section */}
          {userGroups.some(group => group.created_by === user?.id) && (
            <div className="space-y-3 pb-4">              
              <div className="grid gap-3 mt-2">
                {userGroups
                  .filter(group => group.created_by === user?.id)
                  .map(group => (
                    <AnimatePresence key={group.id}>
                      <motion.div
                        initial={{ opacity: 0, y: 5 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ duration: 0.2 }}
                      >
                        <GroupCard
                          id={group.id}
                          name={group.name}
                          description={group.description || ""}
                          isLocked={!group.is_publicly_joinable}
                          isOwner={true}
                          memberCount={group.memberCount || 0}
                          variant="simple"
                          width="100%"
                          onClick={(id) => setCurrentGroupId(Number(id))}
                          className="hover:bg-gradient-to-r hover:from-amber-50/30 hover:to-amber-100/30 dark:hover:from-amber-950/10 dark:hover:to-amber-900/10 hover:shadow transition-all duration-200 border border-amber-200/40 dark:border-amber-900/30 shadow-sm" // Removed scale, reduced shadow to hover:shadow
                          hideStatus={true}
                          actions={
                            <>
                              <Button
                                variant="ghost"
                                size="sm"
                                className="h-8 rounded-full flex items-center gap-0 hover:bg-amber-100/70" // Added amber hover
                                onClick={(e) => {
                                  e.stopPropagation();
                                  fetchGroupMembers(group.id);
                                }}
                                title={t('Voir les membres')}
                              >
                                <Users className="h-4 w-4 text-primary" />
                                <span className="text-xs text-slate-600">
                                  {group.memberCount || 0}
                                </span>
                              </Button>
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-8 w-8 rounded-full hover:bg-amber-100/70" // Added amber hover
                                onClick={(e) => {
                                  e.stopPropagation();
                                  openEditGroupDialog(group);
                                }}
                                title={t('Modifier la salle')}
                              >
                                <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-primary">
                                  <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
                                  <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
                                </svg>
                              </Button>
                              <ChevronRight className="h-5 w-5 text-amber-500/70 transition-transform group-hover:translate-x-1" />
                            </>
                          }
                        />
                      </motion.div>
                    </AnimatePresence>
                  ))}
              </div>
            </div>
          )}
          
          {/* Member groups section */}
          {userGroups.some(group => group.created_by !== user?.id) && (
            <div className="space-y-3">
              
              <div className="grid gap-3 mt-2">
                {userGroups
                  .filter(group => group.created_by !== user?.id)
                  .map((group, index) => (
                    <AnimatePresence key={group.id}>
                      <motion.div
                        initial={{ opacity: 0, y: 5 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ duration: 0.2, delay: index * 0.05 }}
                      >
                        <GroupCard
                          id={group.id}
                          name={group.name}
                          description={group.description || ""}
                          isLocked={!group.is_publicly_joinable}
                          isOwner={false}
                          memberCount={group.memberCount || 0}
                          variant="simple"
                          width="100%"
                          onClick={(id) => setCurrentGroupId(Number(id))}
                          className="hover:bg-gradient-to-r hover:from-blue-50/30 hover:to-blue-100/30 dark:hover:from-blue-950/10 dark:hover:to-blue-900/10 hover:shadow transition-all duration-200 border border-blue-200/40 dark:border-blue-900/30 shadow-sm" // Removed scale, reduced shadow to hover:shadow
                          hideStatus={true}
                          actions={
                            <>
                              <Button
                                variant="ghost"
                                size="sm"
                                className="h-8 rounded-full flex items-center gap-0.5 hover:bg-blue-100/70" // Added blue hover
                                onClick={(e) => {
                                  e.stopPropagation();
                                  fetchGroupMembers(group.id);
                                }}
                                title={t('Voir les membres')}
                              >
                                <Users className="h-4 w-4 text-muted-foreground" />
                                <span className="text-xs text-slate-600">
                                  {group.memberCount || 0}
                                </span>
                              </Button>
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-8 w-8 rounded-full text-red-600 hover:text-red-700 hover:bg-red-100" // Kept destructive hover
                                onClick={(e) => {
                                  e.stopPropagation();
                                  openLeaveConfirmationDialog(group);
                                }}
                                title={t('Quitter la salle')}
                              >
                                <DoorOpen className="h-4 w-4" />
                              </Button>
                              <ChevronRight className="h-5 w-5 text-blue-500/70 transition-transform group-hover:translate-x-1" />
                            </>
                          }
                        />
                      </motion.div>
                    </AnimatePresence>
                  ))}
              </div>
            </div>
          )}
          
          {/* Action cards section */}
          <motion.div 
            className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-8"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3, duration: 0.4 }}
          >
            {/* Explore Card */}
            <motion.button
              onClick={() => openGroupDialog('join')}
              className="group relative px-5 py-3 rounded-2xl border border-white/20 bg-gradient-to-br from-white/60 to-white/30 dark:from-gray-800/60 dark:to-gray-900/30 backdrop-blur-xl hover:from-white/80 hover:to-white/50 dark:hover:from-gray-700/80 dark:hover:to-gray-800/50 hover:border-blue-300/40 dark:hover:border-blue-500/30 hover:shadow-lg hover:shadow-blue-500/10 transition-all duration-300 text-left flex items-center gap-4 shadow-sm hover:-translate-y-0.5"
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: 0.4, duration: 0.3 }}
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
            >
              <motion.div 
                className="shrink-0 bg-gradient-to-br from-blue-500/20 to-blue-600/20 backdrop-blur-sm rounded-2xl p-3 border border-blue-300/20"
                whileHover={{ rotate: 5 }}
                transition={{ type: "spring", stiffness: 300 }}
              >
                <Search className="h-6 w-6 text-blue-600 dark:text-blue-400" />
              </motion.div>
              <div className="flex-1">
                <h3 className="font-semibold text-base text-gray-800 dark:text-gray-100 mb-1">{t('Explorer les salles')}</h3>
              </div>
              <motion.div
                className="shrink-0"
                animate={{ x: [0, 3, 0] }}
                transition={{ 
                  repeat: Infinity, 
                  duration: 2, 
                  ease: "easeInOut",
                  repeatDelay: 3
                }}
              >
                <ChevronRight className="h-5 w-5 text-blue-500/70 group-hover:text-blue-600 group-hover:translate-x-1 transition-all duration-300" />
              </motion.div>
            </motion.button>

            {/* Create Card */}
            <motion.button
              onClick={() => openGroupDialog('create')}
              className="group relative px-5 py-3 rounded-2xl border border-white/20 bg-gradient-to-br from-amber-50/60 to-orange-50/30 dark:from-amber-900/40 dark:to-orange-900/20 backdrop-blur-xl hover:from-amber-100/80 hover:to-orange-100/50 dark:hover:from-amber-800/60 dark:hover:to-orange-800/40 hover:border-amber-300/40 dark:hover:border-amber-400/30 hover:shadow-lg hover:shadow-amber-500/10 transition-all duration-300 text-left flex items-center gap-4 shadow-sm hover:-translate-y-0.5"
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: 0.5, duration: 0.3 }}
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
            >
              <motion.div 
                className="shrink-0 bg-gradient-to-br from-amber-400/20 to-orange-400/20 backdrop-blur-sm rounded-2xl p-3 border border-amber-300/20"
                whileHover={{ rotate: -5 }}
                transition={{ type: "spring", stiffness: 300 }}
              >
                <PlusCircle className="h-6 w-6 text-amber-600 dark:text-amber-400" />
              </motion.div>
              <div className="flex-1">
                <h3 className="font-semibold text-base text-gray-800 dark:text-gray-100 mb-1">{t('Créer une salle')}</h3>
              </div>
              <motion.div
                className="shrink-0"
                animate={{ x: [0, 3, 0] }}
                transition={{ 
                  repeat: Infinity, 
                  duration: 2, 
                  ease: "easeInOut",
                  repeatDelay: 3,
                  delay: 1
                }}
              >
                <ChevronRight className="h-5 w-5 text-amber-500/70 group-hover:text-amber-600 group-hover:translate-x-1 transition-all duration-300" />
              </motion.div>
            </motion.button>
          </motion.div>
          
          {/* Removed the button previously here */}
        </div>
      )}
      
      {/* Rest of the content remains the same, just hidden from direct view */}
      {renderGroupDialog()}
      {renderEditGroupDialog()}
      {renderMembersDialog()}
      {renderLeaveConfirmationDialog()}
      {renderDeleteConfirmationDialog()}
      {renderJoinRequestDialog()}
      
      {/* Share Group Animation */}
      {showShareAnimation && newlyCreatedGroup && (
        <ShareGroupAnimation
          groupName={newlyCreatedGroup.name}
          groupId={newlyCreatedGroup.id}
          isVisible={showShareAnimation}
          onClose={() => {
            setShowShareAnimation(false);
            setNewlyCreatedGroup(null);
          }}
        />
      )}
    </>
  );
} 