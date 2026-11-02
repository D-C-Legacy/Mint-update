import React, { useEffect, useState } from "react";
import { Pressable, ScrollView, View, TextInput } from "react-native";
import { AppText, Button, Icon, s } from "../../components";
import { colors as c, formatUSD, radii, spacing } from "../../theme";
import { InitialsAvatar } from "../../components/live/InitialsAvatar";
import {
  inviteTeamMember,
  listTeamMembers,
  removeTeamMember,
  updateTeamMemberRole,
  acceptTeamInvitation,
  listInvitations,
  cancelInvitation,
  type SellerTeamMember,
  type SellerInvitation,
  type SellerTeamRole,
} from "../../api/seller";
import { describeApiError } from "../../api/describe-error";

const ROLE_LABEL: Record<SellerTeamRole, string> = {
  OWNER: "Owner",
  MANAGER: "Manager",
  STAFF: "Staff",
  VIEW_ONLY: "View only",
};

const ROLE_COLOR: Record<SellerTeamRole, string> = {
  OWNER: c.brand,
  MANAGER: c.success,
  STAFF: c.textSecondary,
  VIEW_ONLY: c.text,
};

const ROLE_OPTIONS: SellerTeamRole[] = ["OWNER", "MANAGER", "STAFF", "VIEW_ONLY"];

export function TeamContent() {
  const [members, setMembers] = useState<SellerTeamMember[]>([]);
  const [invitations, setInvitations] = useState<SellerInvitation[]>([]);
  const [loading, setLoading] = useState(true);
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteRole, setInviteRole] = useState<SellerTeamRole>("STAFF");
  const [inviteBusy, setInviteBusy] = useState(false);
  const [showInviteModal, setShowInviteModal] = useState(false);

  useEffect(() => {
    loadData();
  }, []);

  async function loadData() {
    setLoading(true);
    try {
      const [membersRes, invitationsRes] = await Promise.all([
        listTeamMembers(),
        listInvitations(),
      ]);
      setMembers(membersRes.items);
      setInvitations(invitationsRes.items);
    } catch (err) {
      console.warn("[TeamContent] load failed", err);
    } finally {
      setLoading(false);
    }
  }

  async function handleInvite() {
    if (!inviteEmail.trim() || inviteBusy) return;
    setInviteBusy(true);
    try {
      await inviteTeamMember(inviteEmail.trim(), inviteRole);
      setInviteEmail("");
      setInviteRole("STAFF");
      setShowInviteModal(false);
      loadData();
    } catch (err) {
      alert(describeApiError(err));
    } finally {
      setInviteBusy(false);
    }
  }

  async function handleRemove(memberId: string) {
    if (!confirm("Remove this team member?")) return;
    try {
      await removeTeamMember(memberId);
      setMembers((prev) => prev.filter((m) => m.id !== memberId));
    } catch (err) {
      alert(describeApiError(err));
    }
  }

  async function handleRoleChange(memberId: string, role: SellerTeamRole) {
    try {
      await updateTeamMemberRole(memberId, role);
      setMembers((prev) => prev.map((m) => (m.id === memberId ? { ...m, role } : m)));
    } catch (err) {
      alert(describeApiError(err));
    }
  }

  async function handleCancelInvite(invitationId: string) {
    try {
      await cancelInvitation(invitationId);
      setInvitations((prev) => prev.filter((i) => i.id !== invitationId));
    } catch (err) {
      alert(describeApiError(err));
    }
  }

  if (loading) {
    return <AppText muted>Loading team…</AppText>;
  }

  return (
    <View style={{ gap: spacing.lg }}>
      {/* Current team members */}
      <View style={{ gap: spacing.md }}>
        <AppText size={18} bold>
          Team members ({members.length})
        </AppText>
        {members.length === 0 ? (
          <AppText muted size={14}>No team members yet. Invite someone to get started.</AppText>
        ) : (
          <View style={{ gap: spacing.sm }}>
            {members.map((member) => (
              <View
                key={member.id}
                style={[s.card, { flexDirection: "row", alignItems: "center", gap: spacing.md }]}
              >
                <InitialsAvatar name={member.userId} size={40} />
                <View style={{ flex: 1, gap: 2 }}>
                  <AppText bold size={14}>{member.userId}</AppText>
                  <Pressable
                    onPress={() => {
                      const currentIndex = ROLE_OPTIONS.indexOf(member.role);
                      const next = ROLE_OPTIONS[(currentIndex + 1) % ROLE_OPTIONS.length];
                      if (next) handleRoleChange(member.id, next);
                    }}
                    style={{
                      backgroundColor: ROLE_COLOR[member.role],
                      paddingHorizontal: spacing.sm,
                      paddingVertical: 2,
                      borderRadius: radii.pill,
                      alignSelf: "flex-start",
                    }}
                  >
                    <AppText white size={11} bold>
                      {ROLE_LABEL[member.role]}
                    </AppText>
                  </Pressable>
                </View>
                {member.role !== "OWNER" && (
                  <Pressable
                    onPress={() => handleRemove(member.id)}
                    style={{ padding: spacing.sm }}
                  >
                    <Icon name="trash-outline" size={18} color={c.urgent} />
                  </Pressable>
                )}
              </View>
            ))}
          </View>
        )}
      </View>

      {/* Invite form */}
      <Pressable
        onPress={() => setShowInviteModal(true)}
        style={[s.card, { flexDirection: "row", alignItems: "center", gap: spacing.md }]}
      >
        <Icon name="person-add-outline" size={20} color={c.brand} />
        <AppText bold size={14} style={{ color: c.brand }}>
          Invite team member
        </AppText>
      </Pressable>

      {/* Pending invitations */}
      {invitations.length > 0 && (
        <View style={{ gap: spacing.md }}>
          <AppText size={18} bold>
            Pending invitations ({invitations.length})
          </AppText>
          <View style={{ gap: spacing.sm }}>
            {invitations.map((inv) => (
              <View key={inv.id} style={[s.card, { flexDirection: "row", alignItems: "center", gap: spacing.md }]}>
                <View style={{ flex: 1, gap: 2 }}>
                  <AppText bold size={14}>{inv.email}</AppText>
                  <AppText muted size={12}>
                    {ROLE_LABEL[inv.role]} · {inv.status === "PENDING" ? "Pending" : inv.status}
                  </AppText>
                </View>
                {inv.status === "PENDING" && (
                  <Pressable
                    onPress={() => handleCancelInvite(inv.id)}
                    style={{ padding: spacing.sm }}
                  >
                    <Icon name="close-outline" size={18} color={c.urgent} />
                  </Pressable>
                )}
              </View>
            ))}
          </View>
        </View>
      )}
    </View>
  );
}