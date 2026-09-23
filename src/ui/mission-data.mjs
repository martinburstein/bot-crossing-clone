export function missionRows(plan, threads, scanFresh = true) {
  return plan.roles.map(role => {
    const task = threads.find(t => t.agentPath === role.agentPath && t.parentThreadId === plan.parentThreadId)
    const live = !scanFresh ? 'Unknown' : task ? (task.hasError ? 'Error' : task.running ? 'Working' : 'Idle') : 'Not observed'
    return { ...role, taskId: task?.id || null, live }
  })
}
