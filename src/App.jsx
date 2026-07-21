import { useEffect, useState } from 'react';
import { supabase } from './lib/supabase';
import { createEmptyForm, buildServiceFromForm, formFromService } from './lib/serviceUtils';
import { useMediaQuery } from './hooks/useMediaQuery';
import { useAdminAuth } from './hooks/useAdminAuth';
import { usePushSubscription } from './hooks/usePushSubscription';
import { useScheduleData } from './hooks/useScheduleData';
import { DesktopBlocker } from './components/DesktopBlocker';
import { ParticipantPanel } from './components/ParticipantPanel';
import { WeekAccordionList } from './components/WeekAccordionList';
import { ServiceDetailPanel } from './components/ServiceDetailPanel';
import { AdminLoginPanel } from './components/AdminLoginPanel';
import { AdminServiceForm } from './components/AdminServiceForm';
import { AdminServiceList } from './components/AdminServiceList';

const getAdminPathname = () => window.location.pathname.replace(/\/$/, '') === '/admin';

function App() {
  const isDesktop = useMediaQuery('(min-width: 768px)');
  const isAdminPage = getAdminPathname();

  const schedule = useScheduleData();
  const push = usePushSubscription(schedule.userId);
  const admin = useAdminAuth();

  const [form, setForm] = useState(createEmptyForm);
  const [adminSettingsOpen, setAdminSettingsOpen] = useState(false);
  const isEditing = Boolean(form.id);

  useEffect(() => {
    if (isEditing) setAdminSettingsOpen(true);
  }, [isEditing]);

  const handleSaveService = async (event) => {
    event.preventDefault();
    if (!form.title.trim()) return;

    const result = await schedule.saveService(buildServiceFromForm(form));
    if (result.ok) setForm(createEmptyForm());
  };

  const handleEditService = (service) => setForm(formFromService(service));

  const handleDeleteService = async (serviceId) => {
    const result = await schedule.deleteService(serviceId);
    if (result.ok && form.id === serviceId) setForm(createEmptyForm());
  };

  if (isDesktop && !isAdminPage) {
    return <DesktopBlocker />;
  }

  return (
    <main className={isAdminPage ? 'shell admin-shell' : 'shell'}>
      <section className="hero">
        <div>
          <span className="eyebrow">VidMitka</span>
          <h1>Розклад служінь і відповіді команди</h1>
        </div>
      </section>

      {!isAdminPage ? (
        <>
          <ParticipantPanel
            useAccounts={Boolean(supabase)}
            isNamedAccount={schedule.isNamedAccount}
            participantName={schedule.participantName}
            onNameChange={schedule.changeParticipantName}
            onRegister={schedule.registerAccount}
            onLogin={schedule.loginAccount}
            onLogout={schedule.logoutAccount}
            canVote={schedule.canVote}
            showPushToggle={Boolean(supabase)}
            pushSubscribed={push.subscribed}
            pushStatus={push.status}
            onTogglePush={push.subscribed ? push.disable : push.enable}
          />

          <WeekAccordionList
            groups={schedule.serviceWeekGroups}
            selectedServiceId={schedule.selectedService?.id}
            onSelect={schedule.selectServiceId}
          />

          <ServiceDetailPanel
            service={schedule.selectedService}
            responses={schedule.responses}
            responseOptions={schedule.responseOptions}
            canVote={schedule.canVote}
            userId={schedule.userId}
            voterKey={schedule.voterKey}
            onVote={schedule.vote}
          />
        </>
      ) : !admin.isUnlocked ? (
        <AdminLoginPanel
          passwordInput={admin.passwordInput}
          onPasswordChange={admin.setPasswordInput}
          onSubmit={admin.login}
          error={admin.error}
        />
      ) : (
        <section className="panel">
          <div className="panel-head">
            <div>
              <span className="eyebrow">Адмін-панель</span>
              <h2>Керування розкладом</h2>
            </div>
            <button type="button" className="secondary-button small-button" onClick={admin.logout}>
              Вийти
            </button>
          </div>
          {schedule.remoteStatus ? <p className="field-hint">{schedule.remoteStatus}</p> : null}

          <AdminServiceForm
            form={form}
            setForm={setForm}
            isEditing={isEditing}
            onSubmit={handleSaveService}
            onCancelEdit={() => setForm(createEmptyForm())}
            open={adminSettingsOpen}
            onToggle={setAdminSettingsOpen}
            responseOptionsText={schedule.responseOptionsText}
            onResponseOptionsTextChange={schedule.setResponseOptionsText}
            onSaveResponseOptions={schedule.saveResponseOptions}
            notificationOffset={schedule.notificationOffset}
            onNotificationOffsetChange={schedule.changeNotificationOffset}
          />

          <AdminServiceList
            groups={schedule.serviceWeekGroups}
            responses={schedule.responses}
            profiles={schedule.profiles}
            responseOptions={schedule.responseOptions}
            onEdit={handleEditService}
            onDelete={handleDeleteService}
            onAssignUser={schedule.assignUser}
            onAdminResponseChange={schedule.adminResponseChange}
            onAddAdminResponse={schedule.addAdminResponse}
          />
        </section>
      )}
    </main>
  );
}

export default App;
