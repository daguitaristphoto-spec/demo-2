import { notFound, redirect } from 'next/navigation';
import Link from 'next/link';
import { requireUser } from '@/lib/auth-guard';
import { VideoPanel } from '@/components/judge/video-panel';
import { ScoreForm } from '@/components/judge/score-form';

export default async function JudgeContestantDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { supabase, user, profile } = await requireUser();

  const isAdmin = profile.role === 'admin';

  const { data: assignment } = await supabase
    .from('assignments')
    .select('judge_id, can_edit, contestant:contestants(id, sbd, full_name, video_path)')
    .eq('contestant_id', id)
    .single();

  if (!assignment) {
    notFound();
  }

  if (!isAdmin && assignment.judge_id !== user.id) {
    redirect('/judge');
  }

  const { data: sheet } = await supabase
    .from('score_sheets')
    .select('id, strengths, weaknesses, status, total_score')
    .eq('contestant_id', id)
    .eq('judge_id', assignment.judge_id)
    .maybeSingle();

  const { data: scoreItems } = sheet
    ? await supabase
        .from('score_items')
        .select('criterion_key, criterion_group, score')
        .eq('score_sheet_id', sheet.id)
    : { data: [] as any[] };

  const contestant = Array.isArray(assignment.contestant) ? assignment.contestant[0] : assignment.contestant;
  const canEdit = isAdmin ? true : assignment.can_edit;

  return (
    <main className="detail-layout">
      <header className="detail-header">
        <div>
          <div className="eyebrow">Phiếu chấm vòng 1</div>
          <h1 className="detail-title">{contestant?.sbd} - {contestant?.full_name}</h1>
          <p className="detail-subtitle">Xem video ở cột trái và hoàn thiện phiếu chấm ở cột phải. Tổng điểm được tính tự động theo trọng số.</p>
        </div>
        <Link href={profile.role === 'admin' ? '/admin/assignments' : '/judge'} className="btn btn-secondary">
          Quay lại danh sách
        </Link>
      </header>

      <div className="detail-grid">
        <VideoPanel contestantId={id} contestantName={contestant?.full_name ?? ''} contestantCode={contestant?.sbd ?? ''} />
        <ScoreForm
          contestantId={id}
          canEdit={canEdit}
          strengths={sheet?.strengths}
          weaknesses={sheet?.weaknesses}
          items={scoreItems ?? []}
        />
      </div>
    </main>
  );
}
