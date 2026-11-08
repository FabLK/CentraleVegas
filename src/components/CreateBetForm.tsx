import { useState, useEffect, useMemo, useCallback } from 'react';
import { createClient } from '@/lib/supabase/client';
import { Users,  X, PlusCircle, Calendar as CalendarIcon, 
  Clock, CheckCircle2, ArrowRight, ArrowLeft, ChevronRight, ChevronDown,
   Info, Loader2, FileText, PartyPopper
} from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Calendar as CalendarComponent } from '@/components/ui/calendar';
import { toast } from "sonner"
import { motion, AnimatePresence } from "framer-motion";
import { useGroup } from '@/lib/group/context';
import { useUser } from '@/lib/user/context';
import { useBalance } from '@/lib/balance/context';
import { useTranslation } from 'react-i18next';
import Image from 'next/image';

interface User {
  id: string;
  username: string;
}

interface CreateBetFormProps {
  selectedGroupId: number | null;
  onSuccess?: () => Promise<void>;
  onCancel?: () => void;
  isMobile: boolean;
}

export default function CreateBetForm({ selectedGroupId, onSuccess, onCancel, isMobile }: CreateBetFormProps) {
  const { t } = useTranslation('CreateBetForm');
  const supabase = createClient();
  const { user } = useUser(); // Get user from context
  const { setCurrentGroupId: setCurrentBalanceGroupId } = useBalance(); // Use balance context
  
  // Step management state
  const [currentStep, setCurrentStep] = useState(1);
  const totalSteps = 3;
  
  // Form state
  const [formData, setFormData] = useState({
    title: '',
    options: ['', ''],
    deadline: null as Date | null,
    refereeId: '',
    refereeUsername: '',
  });

  // Time selection state for deadline
  const [selectedTime, setSelectedTime] = useState<string>("12:00");
  // Flag to open the combined deadline picker dialog
  const [isDeadlinePickerOpen, setIsDeadlinePickerOpen] = useState(false);
  
  // Add validation state
  const [validation, setValidation] = useState({
    title: false,
    options: false,
    deadline: false,
    referee: false
  });
  
  // Add a state to track which fields have been touched/interacted with
  const [touched, setTouched] = useState({
    title: false,
    options: false,
    deadline: false,
    referee: false
  });
  
  // Referee selection state
  const [refereeSearch, setRefereeSearch] = useState('');
  const [referees, setReferees] = useState<User[]>([]);
  const [isRefereeDialogOpen, setIsRefereeDialogOpen] = useState(false);
  
  // Blacklist state
  const [blacklistedUsers, setBlacklistedUsers] = useState<User[]>([]);
  const [isBlacklistDialogOpen, setIsBlacklistDialogOpen] = useState(false);
  const [userSearchQuery, setUserSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<User[]>([]);
  
  // Add loading states
  const [isLoadingReferees, setIsLoadingReferees] = useState(false);
  const [isLoadingUsers, setIsLoadingUsers] = useState(false);
  
  // Add loading state
  const [isSubmitting, setIsSubmitting] = useState(false);
  
  // Add the useGroup hook
  const { userGroups } = useGroup();
  
  // Validation functions
  const validateTitle = (title: string): boolean => 
    title.trim() !== '' && title.length <= 65;

  const validateOptions = (options: string[]): boolean => {
    if (options.length < 2 || options.length > 6) return false;
    
    const validOptions = options.filter(opt => opt.trim() !== '' && opt.length <= 15);
    if (validOptions.length !== options.length) return false;
    
    // Check for duplicates
    const uniqueOptions = new Set(validOptions.map(opt => opt.toLowerCase().trim()));
    return uniqueOptions.size === validOptions.length;
  };

  const validateDeadline = (deadline: Date | null): boolean => {
    if (!deadline) return false;
    
    const now = new Date();
    // Clone the date to avoid modifying the original
    const deadlineDate = new Date(deadline);
    
    // Set deadline time to end of day if not specified
    if (deadlineDate.getHours() === 0 && deadlineDate.getMinutes() === 0) {
      deadlineDate.setHours(23, 59, 59);
    }
    
    return deadlineDate > now;
  };

  // Is step valid functions
  const isStep1Valid = (): boolean => {
    return validation.title && validation.deadline;
  };

  const isStep2Valid = (): boolean => {
    return validation.options;
  };

  const isStep3Valid = (): boolean => {
    return validation.referee;
  };
  
  // Check if user can proceed to next step
  const canProceedToNextStep = (): boolean => {
    switch (currentStep) {
      case 1: return isStep1Valid();
      case 2: return isStep2Valid();
      case 3: return isStep3Valid();
      default: return false;
    }
  };

  // Step transition animation variants
  const stepVariants = {
    hidden: (direction: number) => ({
      opacity: 0,
      x: direction > 0 ? 50 : -50,
      scale: 0.95
    }),
    visible: {
      opacity: 1,
      x: 0,
      scale: 1,
      transition: {
        type: "spring",
        stiffness: 300,
        damping: 30,
        duration: 0.4
      }
    },
    exit: (direction: number) => ({
      opacity: 0,
      x: direction > 0 ? -50 : 50,
      scale: 0.95,
      transition: {
        duration: 0.3
      }
    })
  };

  // Direction of transition (1 = forward, -1 = backward)
  const [direction, setDirection] = useState(1);

  // Enhanced navigation functions with direction tracking
  const goToNextStep = (e?: React.MouseEvent) => {
    if (e) e.preventDefault();
    
    if (currentStep < totalSteps && canProceedToNextStep()) {
      setDirection(1);
      setCurrentStep(prev => prev + 1);

    }
  };

  const goToPreviousStep = (e?: React.MouseEvent) => {
    if (e) e.preventDefault();
    
    if (currentStep > 1) {
      setDirection(-1);
      setCurrentStep(prev => prev - 1);
    }
  };

  // Add helper function to get members from a group using context data
  const getGroupMembersFromCache = async (groupId: number) => {
    try {
      // If we're not in a context with loaded groups, fall back to direct DB query
      if (!userGroups || userGroups.length === 0) {
        return null; // Signal to use direct query
      }
      
      // Check if the selected group is in our cached groups
      const group = userGroups.find(g => g.id === groupId);
      if (!group) {
        return null; // Signal to use direct query
      }
      
      // For users in the same group, we need to query their details from the DB
      // This information isn't stored in the group cache
      const { data: groupMembers, error: groupError } = await supabase
        .from('UsersGroupMembership')
        .select(`
          user_id:user,
          user:Users!user (
            id, 
            username
          )
        `)
        .eq('group', groupId);

      if (groupError) throw groupError;
      
      return groupMembers;
    } catch (error) {
      console.error('Error in getGroupMembersFromCache:', error);
      return null; // Signal to use direct query
    }
  };

  // Wrap fetchReferees with useCallback
  const fetchReferees = useCallback(async () => {
    try {
      setIsLoadingReferees(true);
      if (!selectedGroupId) {
        console.log('No group selected, cannot fetch referees');
        setReferees([]);
        return;
      }

      let users: User[] = [];
      
      // Try to get members from cache first
      const cachedMembers = await getGroupMembersFromCache(selectedGroupId);
      
      // If we have cached members, use them
      if (cachedMembers) {
        users = cachedMembers.map(item => ({
          id: item.user && typeof item.user === 'object' && 'id' in item.user ? 
              String(item.user.id) : '',
          username: item.user && typeof item.user === 'object' && 'username' in item.user ? 
              String(item.user.username) : ''
        })).filter(user => user.id && user.username);
      } 
      // Otherwise fall back to direct query
      else {
        const { data: groupMembers, error: groupError } = await supabase
          .from('UsersGroupMembership')
          .select(`
            user_id:user,
            user:Users!user (
              id, 
              username
            )
          `)
          .eq('group', selectedGroupId);

        if (groupError) throw groupError;
        
        users = (groupMembers || []).map(item => ({
          id: item.user && typeof item.user === 'object' && 'id' in item.user ? 
              String(item.user.id) : '',
          username: item.user && typeof item.user === 'object' && 'username' in item.user ? 
              String(item.user.username) : ''
        })).filter(user => user.id && user.username);
      }
      
      // Deduplicate users by ID to prevent duplicate keys
      const uniqueUsers = Array.from(
        new Map(users.map(user => [user.id, user])).values()
      );
      
      setReferees(uniqueUsers);
      console.log('Fetched referees count:', uniqueUsers.length);
    } catch (error) {
      console.error('Error fetching referees:', error);
    } finally {
      setIsLoadingReferees(false);
    }
  }, [selectedGroupId, supabase]);

  // Wrap fetchUsers with useCallback
  const fetchUsers = useCallback(async () => {
    try {
      setIsLoadingUsers(true);
      if (!selectedGroupId) {
        console.log('No group selected, cannot fetch users for blacklist');
        setSearchResults([]);
        return;
      }

      let users: User[] = [];
      
      // Public group case (ID: 1) - fetch all users
      if (selectedGroupId === 1) {
        const { data: allUsers, error: usersError } = await supabase
          .from('Users')
          .select('id, username');

        if (usersError) throw usersError;
        users = allUsers || [];
      } 
      // Private group case - fetch only members of this specific group
      else {
        // Try to get members from cache first
        const cachedMembers = await getGroupMembersFromCache(selectedGroupId);
        
        // If we have cached members, use them
        if (cachedMembers) {
          users = cachedMembers.map(item => ({
            id: item.user && typeof item.user === 'object' && 'id' in item.user ? 
                String(item.user.id) : '',
            username: item.user && typeof item.user === 'object' && 'username' in item.user ? 
                String(item.user.username) : ''
          })).filter(user => user.id && user.username);
        } 
        // Otherwise fall back to direct query
        else {
          const { data: groupMembers, error: groupError } = await supabase
            .from('UsersGroupMembership')
            .select(`
              user_id:user,
              user:Users!user (
                id, 
                username
              )
            `)
            .eq('group', selectedGroupId);

          if (groupError) throw groupError;
          
          users = (groupMembers || []).map(item => ({
            id: item.user && typeof item.user === 'object' && 'id' in item.user ? 
                String(item.user.id) : '',
            username: item.user && typeof item.user === 'object' && 'username' in item.user ? 
                String(item.user.username) : ''
          })).filter(user => user.id && user.username);
        }
      }
      
      // Deduplicate users by ID to prevent duplicate keys
      const uniqueUsers = Array.from(
        new Map(users.map(user => [user.id, user])).values()
      );
      
      // Filter out already blacklisted users
      const filtered = uniqueUsers.filter(u => 
        !blacklistedUsers.some(bu => bu.id === u.id)
      );
      
      setSearchResults(filtered);
      console.log('Fetched users for blacklist count:', filtered.length);
    } catch (error) {
      console.error('Error fetching users:', error);
    } finally {
      setIsLoadingUsers(false);
    }
  }, [selectedGroupId, blacklistedUsers, supabase]);

  // Form handlers
  const handleTitleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const title = e.target.value;
    setFormData(prev => ({ ...prev, title }));
    setValidation(prev => ({ ...prev, title: validateTitle(title) }));
    setTouched(prev => ({ ...prev, title: true }));
  };

  const handleOptionChange = (index: number, value: string) => {
    const newOptions = [...formData.options];
    newOptions[index] = value;
    
    setFormData(prev => ({ ...prev, options: newOptions }));
    setValidation(prev => ({ ...prev, options: validateOptions(newOptions) }));
    setTouched(prev => ({ ...prev, options: true }));
  };

  // Add this new function to detect which specific options are duplicates
  const isDuplicateOption = (index: number): boolean => {
    const currentOption = formData.options[index].trim().toLowerCase();
    if (!currentOption) return false;
    
    return formData.options.some(
      (option, i) => i !== index && option.trim().toLowerCase() === currentOption
    );
  };

  const handleAddOption = () => {
    if (formData.options.length >= 6) {
      toast(t('answers.maxReached'), {
        description: t('answers.maxReachedDescription')
      });
      return;
    }
    
    const newOptions = [...formData.options, ''];
    setFormData(prev => ({ ...prev, options: newOptions }));
    setValidation(prev => ({ ...prev, options: validateOptions(newOptions) }));
  };

  const handleRemoveOption = (index: number) => {
    const newOptions = formData.options.filter((_, i) => i !== index);
    setFormData(prev => ({ ...prev, options: newOptions }));
    setValidation(prev => ({ ...prev, options: validateOptions(newOptions) }));
  };

  // Enhanced deadline handler to apply both date and time together
  const handleDeadlineChange = (date: Date | undefined) => {
    if (!date) return;
    
    // Apply the selected time to this date
    const [hours, minutes] = selectedTime.split(':').map(Number);
    date.setHours(hours, minutes);
    
    setFormData(prev => ({ ...prev, deadline: date }));
    setValidation(prev => ({ ...prev, deadline: validateDeadline(date) }));
    setTouched(prev => ({ ...prev, deadline: true }));
  };
  
  // Separate handler for time change
  const handleTimeChange = (timeString: string) => {
    setSelectedTime(timeString);
    
    // If we already have a date, update it with the new time
    if (formData.deadline) {
      const updatedDate = new Date(formData.deadline);
      const [hours, minutes] = timeString.split(':').map(Number);
      updatedDate.setHours(hours, minutes);
      
      setFormData(prev => ({ ...prev, deadline: updatedDate }));
      setValidation(prev => ({ ...prev, deadline: validateDeadline(updatedDate) }));
    }
    
    setTouched(prev => ({ ...prev, deadline: true }));
  };
  
  // Update the time selection whenever the deadline changes
  useEffect(() => {
    if (formData.deadline) {
      const hours = formData.deadline.getHours().toString().padStart(2, '0');
      const minutes = formData.deadline.getMinutes().toString().padStart(2, '0');
      setSelectedTime(`${hours}:${minutes}`);
    }
  }, [formData.deadline]);

  // Blacklist handlers
  const addUserToBlacklist = (user: User) => {
    setBlacklistedUsers(prev => [...prev, user]);
    setUserSearchQuery('');
  };

  const removeUserFromBlacklist = (userId: string) => {
    setBlacklistedUsers(prev => prev.filter(user => user.id !== userId));
  };

  // Form submission
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    // Mark all fields as touched
    setTouched({
      title: true,
      options: true,
      deadline: true,
      referee: true
    });
    
    if (!user) {
      toast(t('toasts.notConnected'), { description: t('toasts.notConnectedDescription') });
      return;
    }

    if (!selectedGroupId) {
      toast(t('toasts.groupRequired'), { description: t('toasts.groupRequiredDescription') });
      return;
    }

    const isFormValid = validation.title && validation.options && validation.deadline && validation.referee;
    
    if (!isFormValid) {
      toast(t('toasts.invalidInfo'), { description: t('toasts.invalidInfoDescription') });
      return;
    }

    // Set submitting state to true
    setIsSubmitting(true);

    try {
      // Step 1: Create the BettingGame record
      const { data: betData, error: betError } = await supabase
        .from('BettingGame')
        .insert({
          title: formData.title,
          created_by: user.id,
          group: selectedGroupId,
          deadline: formData.deadline?.toISOString() || null,
          referee: formData.refereeId,
          // Remove options and blacklisted_users from here
        })
        .select('id')
        .single();

      if (betError) throw betError;

      // Filter out empty options
      const validOptions = formData.options.filter(opt => opt.trim() !== '');

      // Step 2: Create BettingOption records for each option
      const optionsToInsert = validOptions.map(optionTitle => ({
        title: optionTitle,
        game: betData.id,
        is_winning: false
      }));

      const { error: optionsError } = await supabase
        .from('BettingOption')
        .insert(optionsToInsert)
        .select('id');

      if (optionsError) throw optionsError;

      // Step 4: Add blacklisted users to UsersExcludedFrom table
      if (blacklistedUsers.length > 0) {
        const excludedUsersToInsert = blacklistedUsers.map(blockedUser => ({
          user: blockedUser.id,
          game: betData.id
        }));

        const { error: blacklistError } = await supabase
          .from('UsersExcludedFrom')
          .insert(excludedUsersToInsert);

        if (blacklistError) throw blacklistError;
      }
      

      // Reset form
      setFormData({
        title: '',
        options: ['', ''],
        deadline: null,
        refereeId: '',
        refereeUsername: '',
      });
      setBlacklistedUsers([]);

      toast(t('toasts.betCreated'), { description: t('toasts.betCreatedDescription') });

      if (onSuccess) await onSuccess();
      
      // Close the form after successful creation
      if (onCancel) onCancel();
    } catch (error: unknown) {
      console.error('Error creating bet:', error);
      const errorMessage = error instanceof Error ? error.message : "Une erreur s'est produite";
      toast(t('toasts.creationError'), { description: errorMessage });
    } finally {
      // Set submitting state to false
      setIsSubmitting(false);
    }
  };

  // Effects
  
  // Update useEffect hooks with proper dependencies
  useEffect(() => {
    if (selectedGroupId) {
      fetchReferees();
      fetchUsers();
      setCurrentBalanceGroupId(selectedGroupId); // Set current group for balance context
    }
  }, [selectedGroupId, fetchReferees, fetchUsers, setCurrentBalanceGroupId]);

  useEffect(() => {
    if (isRefereeDialogOpen && referees.length === 0 && !isLoadingReferees) {
      fetchReferees();
    }
  }, [isRefereeDialogOpen, referees.length, isLoadingReferees, fetchReferees]);

  useEffect(() => {
    if (isBlacklistDialogOpen && searchResults.length === 0 && !isLoadingUsers) {
      fetchUsers();
    }
  }, [isBlacklistDialogOpen, searchResults.length, isLoadingUsers, fetchUsers]);

  // Client-side filtering for referees (similar to leaderboard page)
  const filteredReferees = useMemo(() => {
    if (!refereeSearch.trim()) {
      console.log('Empty referee search, showing all', referees.length, 'referees');
      return referees;
    }
    
    const filtered = referees.filter((ref: User) => 
      ref.username.toLowerCase().includes(refereeSearch.toLowerCase())
    );
    console.log(
      `Referee search: "${refereeSearch}" - Found ${filtered.length} matches out of ${referees.length} total`
    );
    return filtered;
  }, [referees, refereeSearch]);

  // Client-side filtering for blacklist search
  const filteredSearchResults = useMemo(() => {
    if (!userSearchQuery.trim()) {
      // Return all search results when search is empty, excluding already blacklisted users
      return searchResults.filter(user => 
        !blacklistedUsers.some(bu => bu.id === user.id)
      );
    }
    
    const filtered = searchResults.filter((user: User) => 
      user.username.toLowerCase().includes(userSearchQuery.toLowerCase()) &&
      !blacklistedUsers.some(bu => bu.id === user.id)
    );
    console.log(
      `Blacklist search: "${userSearchQuery}" - Found ${filtered.length} matches out of ${searchResults.length} total`
    );
    return filtered;
  }, [searchResults, userSearchQuery, blacklistedUsers]);


  return (
    <form onSubmit={handleSubmit} className={`grid gap-5 ${isMobile ? 'py-2' : 'py-6'} relative w-full max-w-3xl mx-auto bg-gradient-to-b from-background to-muted/20 px-5 sm:px-8 rounded-xl border border-muted/40 shadow-sm overflow-hidden`}>
      {/* Progress bar with enhanced animation */}
      <div className="relative w-full h-3 bg-muted/40 rounded-full mb-4 overflow-hidden shadow-inner">
        <motion.div 
          className="absolute left-0 top-0 bottom-0 bg-gradient-to-r from-primary/80 via-primary/90 to-primary"
          initial={{ width: `${((currentStep - 1) / totalSteps) * 100}%` }}
          animate={{ width: `${(currentStep / totalSteps) * 100}%` }}
          transition={{ 
            type: "spring", 
            stiffness: 70, 
            damping: 20,
            mass: 1
          }}
        />
      </div>
      
      {/* Enhanced step indicators */}
      <div className="flex justify-between items-center mb-2 sm:mb-8 relative">
        {/* Connector lines as background elements */}
        <div className="absolute top-[18px] left-0 w-full h-[2px] flex justify-between pointer-events-none -z-10">
          <div className="w-[calc(50%-1.125rem)] ml-[4.5rem] mr-[2rem] h-full">
            <motion.div className="h-full bg-muted rounded-full overflow-hidden">
              <motion.div 
                className="h-full bg-primary origin-left"
                initial={{ scaleX: 0 }}
                animate={{ scaleX: currentStep > 1 ? 1 : 0 }}
                transition={{ delay: 0.1, duration: 0.5, ease: "easeInOut" }}
              />
            </motion.div>
          </div>
          <div className="w-[calc(50%-1.125rem)] mr-[4rem] ml-[2rem] h-full">
            <motion.div className="h-full bg-muted rounded-full overflow-hidden">
              <motion.div 
                className="h-full bg-primary origin-left"
                initial={{ scaleX: 0 }}
                animate={{ scaleX: currentStep > 2 ? 1 : 0 }}
                transition={{ delay: 0.1, duration: 0.5, ease: "easeInOut" }}
              />
            </motion.div>
          </div>
        </div>
        
        {/* Step indicators */}
        {[1, 2, 3].map((step) => (
          <div key={step} className="flex flex-col items-center relative z-10">
            <motion.div 
              className={cn(
                "flex items-center justify-center rounded-full transition-all duration-300",
                "shadow-sm border-2 w-9 h-9", 
                currentStep === step 
                  ? "bg-primary border-primary text-primary-foreground" 
                  : step < currentStep 
                    ? "bg-primary/10 border-primary/30 text-primary" 
                    : "bg-background border-muted text-muted-foreground"
              )}
              animate={{
                scale: currentStep === step ? 1.1 : 1,
                boxShadow: currentStep === step ? "0 0 0 4px rgba(var(--primary), 0.2)" : "none"
              }}
              transition={{
                type: "spring",
                stiffness: 500,
                damping: 30
              }}
            >
              {step < currentStep ? (
                <motion.div
                  initial={{ scale: 0 }}
                  animate={{ scale: 1 }}
                  transition={{ 
                    type: "spring", 
                    stiffness: 500, 
                    damping: 30, 
                    delay: 0.2 
                  }}
                >
                  <CheckCircle2 className="h-5 w-5" />
                </motion.div>
              ) : (
                <span className="text-sm font-medium">{step}</span>
              )}
            </motion.div>
            
            <motion.span 
              className={cn(
                "text-xs mt-3 font-medium transition-colors",
                currentStep === step ? "text-primary" : "text-muted-foreground"
              )}
              animate={{
                scale: currentStep === step ? 1.05 : 1,
                y: currentStep === step ? -2 : 0
              }}
              transition={{ type: "spring", stiffness: 500, damping: 30 }}
            >
              {step === 1 && t('steps.basicInfo')}
              {step === 2 && t('steps.answers')}
              {step === 3 && t('steps.participants')}
            </motion.span>
          </div>
        ))}
      </div>
      
      {/* Step content with enhanced transitions */}
      <AnimatePresence mode="wait">
        <motion.div
          key={currentStep}
          custom={direction}
          variants={stepVariants}
          initial="hidden"
          animate="visible"
          exit="exit"
          className="w-full"
        >
          {/* Step 1: Title and Deadline */}
          {currentStep === 1 && (
            <div className="space-y-6">
              {/* Refactored Title section */}
              <div 
                className={cn(
                  "relative flex flex-col gap-3 p-4 rounded-lg border transition-all",
                  validation.title 
                    ? "border-green-500/50 bg-green-50/30" 
                    : touched.title && formData.title 
                      ? "border-red-500/50 bg-red-50/30" 
                      : "border-muted bg-muted/30"
                )}
              >
                <div className="flex items-center gap-3 mb-2">
                  <FileText className="h-6 w-6 text-primary/70" />
                  <div>
                    <label className="text-base font-medium flex items-center gap-2">
                      {t('basicInfo.title')}
                      {validation.title && <CheckCircle2 className="h-4 w-4 text-green-500" />}
                    </label>
                  </div>
                </div>
                
                <div className="relative">
                  <Input
                    type="text"
                    placeholder={t('basicInfo.titlePlaceholder')}
                    value={formData.title}
                    onChange={handleTitleChange}
                    onFocus={() => setTouched(prev => ({ ...prev, title: true }))}
                    maxLength={65}
                    className={cn(
                      "w-full transition-all duration-200 pr-16 focus-visible:ring-offset-1 bg-background", // Added bg-background
                      "border-input/50 shadow-sm",
                      validation.title 
                        ? "border-green-500/50 focus-visible:ring-green-300" // Removed bg-green-50/30
                        : touched.title && formData.title 
                          ? "border-red-500/50 focus-visible:ring-red-300" // Removed bg-red-50/30
                          : "hover:border-input focus-visible:border-primary"
                    )}
                  />
                  <div className="absolute right-3 top-1/2 -translate-y-1/2 text-xs font-medium rounded-full px-1.5 py-0.5 bg-muted/80 text-muted-foreground">
                    {formData.title.length}/65
                  </div>
                </div>
                {touched.title && formData.title && !validation.title && (
                  <p className="text-xs text-red-500 font-medium flex items-center gap-1.5 mt-1">
                    <X className="h-3.5 w-3.5" />
                    {t('basicInfo.titleError')}
                  </p>
                )}
              </div>
              
              {/* Refactored Deadline picker */}
              <div className="flex flex-col gap-2">
                <div 
                  className={cn(
                    "relative flex items-center p-4 rounded-lg border transition-all cursor-pointer",
                    "hover:border-primary/50 hover:bg-primary/5",
                    validation.deadline 
                      ? "border-green-500/50 bg-green-50/30" 
                      : touched.deadline && formData.deadline === null 
                        ? "border-red-500/50 bg-red-50/30" 
                        : "border-muted bg-muted/30"
                  )}
                  onClick={(e) => {
                    e.preventDefault(); // Prevent form submission
                    setTouched(prev => ({ ...prev, deadline: true }));
                    setIsDeadlinePickerOpen(true);
                  }}
                >
                  <CalendarIcon className="h-6 w-6 text-primary/70 mr-3" />
                  <div className="flex-1">
                    <label className="text-base font-medium flex items-center gap-2">
                      {t('basicInfo.deadline')}
                      {validation.deadline && <CheckCircle2 className="h-4 w-4 text-green-500" />}
                    </label>
                    <div className="text-sm text-muted-foreground">
                      {formData.deadline ? (
                        <span>
                          {formData.deadline.toLocaleDateString()} à {formData.deadline.getHours().toString().padStart(2, '0')}:{formData.deadline.getMinutes().toString().padStart(2, '0')}
                        </span>
                      ) : (
                        <span></span>
                      )}
                    </div>
                  </div>
                  <ChevronDown className="h-4 w-4 text-muted-foreground ml-2" />
                </div>
                
                {touched.deadline && !validation.deadline && (
                  <p className="text-xs text-red-500 font-medium flex items-center gap-1.5 px-1">
                    <X className="h-3.5 w-3.5" />
                    {formData.deadline === null 
                      ? t('basicInfo.deadlineError')
                      : t('basicInfo.deadlineFutureError')}
                  </p>
                )}
                
                {/* Deadline picker Dialog remains the same */}
                <Dialog open={isDeadlinePickerOpen} onOpenChange={(open) => { 
                  setIsDeadlinePickerOpen(open);
                  if (open) setTouched(prev => ({ ...prev, deadline: true }));
                }}>
                  <DialogContent className="sm:max-w-md p-4 pt-6 sm:pt-6 sm:p-6 flex flex-col max-h-[90vh] my-auto" fullScreenOnMobile={true}>
                    <DialogHeader className="mb-4">
                      <DialogTitle>{t('basicInfo.deadlineDialogTitle')}</DialogTitle>
                    </DialogHeader>
                    
                    <div className="space-y-5 overflow-y-auto">
                      {/* Calendar component for date selection */}
                      <div className="flex justify-center">
                        <CalendarComponent
                          mode="single"
                          selected={formData.deadline || undefined}
                          onSelect={handleDeadlineChange}
                          initialFocus
                          className="rounded-md mx-auto border shadow-sm overflow-hidden"
                          disabled={(date) => date < new Date(new Date().setHours(0, 0, 0, 0))}
                        />
                      </div>
                      
                      {/* Time picker section */}
                      <div className="bg-muted/30 rounded-lg px-4 py-3 border shadow-sm">
                        <div className="flex items-center justify-center mb-2">
                          <Clock className="mr-2 h-4 w-4 text-primary/70" />
                          <span className="text-sm font-medium">{t('basicInfo.timeLimit')}</span>
                        </div>
                        
                        <div className="flex justify-center">
                          <Input
                            type="time"
                            value={selectedTime}
                            onChange={(e) => handleTimeChange(e.target.value)}
                            className="w-48 text-center shadow-sm focus-visible:ring-offset-1 flex justify-center items-center"
                          />
                        </div>
                      </div>
                      
                      {/* Confirm button */}
                      <Button 
                        type="button" 
                        className="w-full mt-2"
                        onClick={() => {
                          // If date is already selected, just update time
                          if (formData.deadline) {
                            const [hours, minutes] = selectedTime.split(':').map(Number);
                            const updatedDate = new Date(formData.deadline);
                            updatedDate.setHours(hours, minutes);
                            
                            // Validate the date is in the future before setting it
                            if (validateDeadline(updatedDate)) {
                              setFormData(prev => ({ ...prev, deadline: updatedDate }));
                              setValidation(prev => ({ ...prev, deadline: true }));
                              setIsDeadlinePickerOpen(false);
                            } else {
                              toast(t('basicInfo.invalidDateError'), { description: t('basicInfo.invalidDateDescription') });
                            }
                          } else {
                            // If no date selected, use today with selected time
                            const today = new Date();
                            const [hours, minutes] = selectedTime.split(':').map(Number);
                            today.setHours(hours, minutes);
                            
                            // Validate the date is in the future before setting it
                            if (validateDeadline(today)) {
                              setFormData(prev => ({ ...prev, deadline: today }));
                              setValidation(prev => ({ ...prev, deadline: true }));
                              setIsDeadlinePickerOpen(false);
                            } else {
                              toast(t('basicInfo.invalidDateError'), { description: t('basicInfo.invalidDateDescription') });
                            }
                          }
                        }}
                        disabled={!formData.deadline || (formData.deadline && !validateDeadline((() => {
                          // Create a copy of the deadline with the current selected time
                          if (!formData.deadline) return null;
                          const date = new Date(formData.deadline);
                          const [hours, minutes] = selectedTime.split(':').map(Number);
                          date.setHours(hours, minutes);
                          return date;
                        })()))}
                      >
                        {t('basicInfo.confirm')}
                      </Button>
                    </div>
                  </DialogContent>
                </Dialog>
              </div>
            </div>
          )}
          
          {/* Step 2: Réponses */}
          {currentStep === 2 && (
            <div className="space-y-6">
              <div className="space-y-3">
                {formData.options.map((option, index) => (
                  <motion.div 
                    key={index} 
                    className="flex items-center gap-2 group"
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.3, delay: index * 0.1 }}
                  >
                    <div className="w-8 h-8 flex items-center justify-center rounded-full bg-muted/80 text-xs font-medium shadow-sm border border-border/30">
                      {index + 1}
                    </div>
                    <div className="relative flex-1">
                      <Input
                        type="text"
                        placeholder={`${t('answers.answerPlaceholder')} ${index + 1}`}
                        value={option}
                        onChange={(e) => handleOptionChange(index, e.target.value)}
                        onFocus={() => setTouched(prev => ({ ...prev, options: true }))}
                        maxLength={15}
                        className={cn(
                          "w-full transition-all duration-200 pr-16",
                          "shadow-sm",
                          option.trim() && option.length <= 15 && !isDuplicateOption(index) 
                            ? "border-green-500/50 focus-visible:ring-green-300 bg-green-50/30" 
                            : touched.options && option 
                              ? "border-red-500/50 focus-visible:ring-red-300 bg-red-50/30" 
                              : "bg-background border-input/50"
                        )}
                      />
                      <div className="absolute right-3 top-1/2 -translate-y-1/2 text-xs rounded-full px-1.5 py-0.5 bg-muted/80 text-muted-foreground font-medium">
                        {option.length}/15
                      </div>
                    </div>
                    {formData.options.length > 2 && (
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        onClick={() => handleRemoveOption(index)}
                        className="hover:bg-red-100 hover:text-red-500 transition-all duration-200 rounded-full h-8 w-8 p-0 shadow-sm"
                      >
                        <X className="h-4 w-4" />
                      </Button>
                    )}
                  </motion.div>
                ))}
                
                <Button
                  type="button"
                  variant="outline"
                  className="w-full mt-4 border-dashed border-primary/40 hover:border-primary hover:bg-primary/5 transition-all duration-200"
                  onClick={handleAddOption}
                  disabled={formData.options.length >= 6}
                >
                  <PlusCircle className="h-4 w-4 mr-2" />
                  {t('answers.addAnswer')}
                </Button>
                
                {/* Multiplier component */}
                <motion.div 
                  className="bg-muted/40 rounded-lg border border-muted/60 p-3 shadow-sm mt-6"
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.3 }}
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <Image
                        src="/Red lever.png"
                        alt="Red lever"
                        width={40}
                        height={40}
                        className="object-contain"
                        priority
                        quality={100}
                        unoptimized
                      />
                      <div>
                        <h4 className="text-sm font-medium text-foreground/80">{t('answers.initialMultiplier')}</h4>
                        <p className="text-xs text-muted-foreground">{t('answers.multiplierDescription')}</p>
                      </div>
                    </div>
                    
                    <div className="bg-background border border-muted/80 px-3 py-1.5 rounded-md shadow-sm flex items-center justify-center">
                      <span className="text-base font-medium text-muted-foreground">
                        x{formData.options.filter(opt => opt.trim() !== '').length >= 2 ? formData.options.filter(opt => opt.trim() !== '').length : "2"}
                      </span>
                    </div>
                  </div>
                </motion.div>
              </div>
            </div>
          )}
          
          {/* Step 3: Referee and Blacklist */}
          {currentStep === 3 && (
            <div className="space-y-6">
              {/* Referee selection */}
              <div className="flex flex-col gap-3">
                
                <div 
                  className={cn(
                    "relative flex items-center p-4 rounded-lg border transition-all cursor-pointer",
                    "hover:border-primary/50 hover:bg-primary/5",
                    validation.referee 
                      ? "border-green-500/50 bg-green-50/30" 
                      : touched.referee && formData.refereeId 
                        ? "border-red-500/50 bg-red-50/30" 
                        : "border-muted bg-muted/30"
                  )}
                  onClick={(e) => {
                    e.preventDefault(); // Prevent form submission
                    if (!selectedGroupId) return;
                    setTouched(prev => ({ ...prev, referee: true }));
                    setIsRefereeDialogOpen(true);
                    fetchReferees();
                  }}
                >
                  <Image 
                    src="/referee-laughing.png" 
                    alt="Referee" 
                    width={80} 
                    height={80} 
                    className="object-contain mr-4"
                  />
                  
                  <div className="flex-1">
                    {formData.refereeUsername ? (
                      <div className="flex items-center">
                        <div>
                          <div className="text-lg font-medium">{formData.refereeUsername}</div>
                          <div className="text-sm text-muted-foreground">{t('participants.refereeDescription')}</div>
                        </div>
                      </div>
                    ) : (
                      <>
                        <div className="text-lg font-medium">{t('participants.referee')}</div>
                        <div className="text-sm text-muted-foreground">
                          {t('participants.refereeDescription')}
                        </div>
                      </>
                    )}
                  </div>
                  

                </div>
              </div>

              {/* Dialog for referee selection */}
              <Dialog open={isRefereeDialogOpen} onOpenChange={(open) => {
                setIsRefereeDialogOpen(open);
                if (open) setTouched(prev => ({ ...prev, referee: true }));
              }}>
                <DialogContent className="sm:max-w-md p-4 pt-6 sm:pt-6 sm:p-6 flex flex-col max-h-[90vh] my-auto" fullScreenOnMobile={true}>
                  <DialogHeader className="mb-4">
                    <DialogTitle>{t('participants.chooseReferee')}</DialogTitle>
                  </DialogHeader>
                  
                  <div className="space-y-3 overflow-y-auto">
                    <Input
                      placeholder={t('participants.searchPlaceholder')}
                      value={refereeSearch}
                      onChange={(e) => setRefereeSearch(e.target.value)}
                      className="focus-visible:ring-0 focus-visible:ring-offset-0 focus:outline-none h-9 text-sm mb-2"
                    />
                    
                    {isLoadingReferees ? (
                      <div className="p-4 text-center text-sm text-muted-foreground">
                        {t('participants.loadingUsers')}
                      </div>
                    ) : filteredReferees.length > 0 ? (
                      <div className="space-y-2 pt-1">
                        {filteredReferees.map((referee) => (
                          <Button
                            key={referee.id}
                            variant="ghost"
                            type="button"
                            onClick={() => {
                              setFormData(prev => ({
                                ...prev,
                                refereeId: referee.id,
                                refereeUsername: referee.username
                              }));
                              setValidation(prev => ({ ...prev, referee: true }));
                              setIsRefereeDialogOpen(false);
                            }}
                            className="w-full justify-start px-3 py-1.5 h-auto hover:bg-muted/80"
                          >
                            <Avatar className="h-6 w-6 mr-2 border shadow-sm">
                              <AvatarFallback className="bg-primary/10 text-primary font-medium text-xs">
                                {referee.username.substring(0, 2).toUpperCase()}
                              </AvatarFallback>
                            </Avatar>
                            <span className="text-sm">{referee.username}</span>
                          </Button>
                        ))}
                      </div>
                    ) : (
                      <div className="p-8 text-center flex flex-col items-center justify-center h-[200px] text-sm text-muted-foreground">
                        {refereeSearch ? (
                          <>
                            <Users className="h-10 w-10 mb-3 text-muted-foreground/30" />
                            <p>{t('participants.noUsersFound')}</p>
                          </>
                        ) : (
                          <>
                            <Info className="h-10 w-10 mb-3 text-muted-foreground/30" />
                            <p>{t('participants.enterNameToSearch')}</p>
                            <p className="text-xs mt-1 text-muted-foreground/70">{t('participants.browseUsers')}</p>
                          </>
                        )}
                      </div>
                    )}
                  </div>
                </DialogContent>
              </Dialog>

              {/* Excluded players */}
              <div className="flex flex-col gap-3 mt-8">
                
                <div 
                  className={cn(
                    "relative flex items-center p-4 rounded-lg border transition-all cursor-pointer",
                    "hover:border-primary/50 hover:bg-primary/5",
                    blacklistedUsers.length > 0 
                      ? "border-green-500/50 bg-green-50/30" 
                      : "border-muted bg-muted/30"
                  )}
                  onClick={(e) => {
                    e.preventDefault(); // Prevent form submission
                    if (!selectedGroupId) return;
                    setIsBlacklistDialogOpen(true);
                    fetchUsers();
                  }}
                >
                  <Image 
                    src="/surprised-prisoner.png" 
                    alt="Excluded User" 
                    width={80} 
                    height={80} 
                    className="object-contain mr-4"
                  />
                  
                  <div className="flex-1">
                    {blacklistedUsers.length > 0 ? (
                      <div>
                        <div className="text-lg font-medium">
                          {blacklistedUsers.length} {blacklistedUsers.length > 1 ? t('participants.playersExcludedPlural') : t('participants.playersExcluded')} {blacklistedUsers.length > 1 ? t('participants.excludedPlural') : t('participants.excluded')}
                        </div>
                        <div className="flex flex-wrap gap-1 mt-1 max-w-[280px]">
                          {blacklistedUsers.slice(0, 2).map((user) => (
                            <div key={user.id} className="inline-flex items-center py-0.5 bg-muted/60 rounded-full text-sm">
                              {user.username}
                            </div>
                          ))}
                          {blacklistedUsers.length > 2 && (
                            <div className="inline-flex items-center py-0.5 bg-muted/60 rounded-full text-sm">
                              +{blacklistedUsers.length - 2}
                            </div>
                          )}
                        </div>
                      </div>
                    ) : (
                      <>
                        <div className="text-lg font-medium">{t('participants.excludedPlayers')}</div>
                        <div className="text-sm text-muted-foreground">
                          {t('participants.excludedPlayersDescription')}
                        </div>
                      </>
                    )}
                  </div>
                  
                </div>
              </div>
              
              {/* Dialog for blacklist selection */}
              <Dialog open={isBlacklistDialogOpen} onOpenChange={(open) => {
                setIsBlacklistDialogOpen(open);
              }}>
                <DialogContent className="sm:max-w-md p-4 pt-6 sm:pt-6 sm:p-6 flex flex-col max-h-[90vh] my-auto" fullScreenOnMobile={true}>
                  <DialogHeader className="mb-4">
                    <DialogTitle>{t('participants.excludeUsers')}</DialogTitle>
                  </DialogHeader>
                  
                  <div className="space-y-4 overflow-y-auto">
                    {blacklistedUsers.length > 0 && (
                      <div className="mb-4 pt-1">
                        <h3 className="text-xs font-medium text-muted-foreground mb-2">
                          {t('participants.excludedUsersCount')} ({blacklistedUsers.length})
                        </h3>
                        <div className="flex flex-wrap gap-2">
                          {blacklistedUsers.map((user) => (
                            <div 
                              key={user.id}
                              className="flex items-center gap-1 px-3 py-1.5 bg-muted/30 rounded-full border text-sm shadow-sm"
                            >
                              <Avatar className="h-5 w-5 mr-1">
                                <AvatarFallback className="text-xs bg-primary/10 text-primary">
                                  {user.username.substring(0, 2).toUpperCase()}
                                </AvatarFallback>
                              </Avatar>
                              {user.username}
                              <Button
                                type="button" 
                                size="icon" 
                                variant="ghost"
                                onClick={() => removeUserFromBlacklist(user.id)}
                                className="h-5 w-5 p-0 ml-1 rounded-full hover:bg-red-100 hover:text-red-500 transition-colors"
                              >
                                <X className="h-3 w-3" />
                              </Button>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                    
                    <Input
                      placeholder={t('participants.searchPlaceholder')}
                      value={userSearchQuery}
                      onChange={(e) => setUserSearchQuery(e.target.value)}
                      className="focus-visible:ring-0 focus-visible:ring-offset-0 focus:outline-none h-9 text-sm mb-2"
                    />
                    
                    {isLoadingUsers ? (
                      <div className="p-4 text-center text-sm text-muted-foreground">
                        {t('participants.loadingUsers')}
                      </div>
                    ) : filteredSearchResults.length > 0 ? (
                      <div className="space-y-1">
                        {filteredSearchResults.map((user) => (
                          <Button
                            key={user.id}
                            variant="ghost"
                            type="button"
                            onClick={() => addUserToBlacklist(user)}
                            className="w-full justify-start px-3 py-1.5 h-auto hover:bg-muted/80"
                          >
                            <Avatar className="h-6 w-6 mr-2 border shadow-sm">
                              <AvatarFallback className="bg-primary/10 text-primary font-medium text-xs">
                                {user.username.substring(0, 2).toUpperCase()}
                              </AvatarFallback>
                            </Avatar>
                            <span className="text-sm">{user.username}</span>
                          </Button>
                        ))}
                      </div>
                    ) : (
                      <div className="p-8 text-center flex flex-col items-center justify-center h-[200px] text-sm text-muted-foreground">
                        <Users className="h-10 w-10 mb-3 text-muted-foreground/30" />
                        <p>{t('participants.noUsersFound')}</p>
                      </div>
                    )}
                  </div>
                  
                  <Button
                    className="mt-6 w-full"
                    type="button"
                    variant="secondary"
                    onClick={() => setIsBlacklistDialogOpen(false)}
                  >
                    {t('participants.close')}
                  </Button>
                </DialogContent>
              </Dialog>
            </div>
          )}
        </motion.div>
      </AnimatePresence>
      
      {/* Navigation buttons with enhanced animations */}
      <div className="flex justify-between mt-10">
        {currentStep > 1 ? (
          <motion.div whileHover={{ x: -3 }} whileTap={{ scale: 0.97 }}>
            <Button
              type="button"
              variant="outline"
              onClick={(e) => goToPreviousStep(e)}
              className="gap-2 transition-all hover:bg-muted/80 hover:border-muted-foreground/30"
              disabled={isSubmitting}
            >
              <ArrowLeft className="h-4 w-4" />
              {t('navigation.previous')}
            </Button>
          </motion.div>
        ) : (
          <motion.div whileHover={{ x: -3 }} whileTap={{ scale: 0.97 }}>
            <Button 
              type="button" 
              variant="outline"
              onClick={onCancel}
              className="gap-2 transition-all hover:bg-red-50 hover:text-red-600 hover:border-red-200"
              disabled={isSubmitting}
            >
              <X className="h-4 w-4" />
              {t('navigation.cancel')}
            </Button>
          </motion.div>
        )}
        
        {currentStep < totalSteps ? (
          <motion.div 
            whileHover={{ x: 3 }} 
            whileTap={{ scale: 0.97 }}
            animate={{ 
              y: canProceedToNextStep() ? [0, -3, 0] : 0 
            }}
            transition={{ 
              repeat: canProceedToNextStep() ? Infinity : 0, 
              repeatDelay: 2.5,
              duration: 0.5
            }}
          >
            <Button
              type="button"
              onClick={(e) => goToNextStep(e)}
              disabled={!canProceedToNextStep() || isSubmitting}
              className="gap-2 shadow-md transition-all hover:shadow-lg"
            >
              {t('navigation.next')}
              <ArrowRight className="h-4 w-4" />
            </Button>
          </motion.div>
        ) : (
          <motion.div 
            className="relative"
            whileHover={{ scale: 1.03 }}
            whileTap={{ scale: 0.97 }}
            animate={isStep3Valid() ? { 
              y: [0, -2, 0],
            } : {}}
            transition={{ 
              repeat: isStep3Valid() ? Infinity : 0, 
              repeatDelay: 2,
              duration: 1
            }}
          >
            <Button 
              type="submit"
              disabled={!isStep3Valid() || isSubmitting}
              className={cn(
                "gap-2 shadow-md transition-all w-full", 
                isStep3Valid() 
                  ? "bg-gradient-to-r from-primary via-primary/90 to-primary/80 hover:shadow-lg" 
                  : ""
              )}
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  {t('navigation.creating')}
                </>
              ) : (
                <>
                  {t('navigation.createBet')}
                  <motion.div
                    animate={{ x: [0, 3, 0] }}
                    transition={{ 
                      repeat: Infinity, 
                      repeatDelay: 1,
                      duration: 0.5,
                      ease: "easeInOut"
                    }}
                  >
                    <ChevronRight className="h-4 w-4" />
                  </motion.div>
                </>
              )}
            </Button>
            {currentStep === totalSteps && isStep3Valid() && !isSubmitting && (
              <motion.div 
                className="absolute -top-3 -right-2 z-10"
                initial={{ scale: 0, rotate: -10 }}
                animate={{ scale: 1, rotate: 0 }}
                transition={{
                  type: "spring",
                  stiffness: 500,
                  damping: 20,
                  delay: 0.3
                }}
              >
                <div className="flex items-center justify-center px-2.5 py-1 bg-gradient-to-r from-blue-600 to-blue-500 text-white text-[10px] font-semibold rounded-full shadow-lg border border-blue-400">
                  <PartyPopper className="h-3 w-3 mr-1" />
                  +10%
                </div>
              </motion.div>
            )}
          </motion.div>
        )}
      </div>
    </form>
  );
} 