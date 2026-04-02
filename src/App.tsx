import { useState } from 'react'
import Layout from './components/Layout'
import UsageTab from './components/tabs/UsageTab'
import SkillsTab from './components/tabs/SkillsTab'
import EditorTab from './components/tabs/EditorTab'
import ActivityTab from './components/tabs/ActivityTab'
import MoltbookTab from './components/tabs/MoltbookTab'
import CronTab from './components/tabs/CronTab'
import GitHubTrendingTab from './components/tabs/GitHubTrendingTab'
import AgentsPlaygroundTab from './components/tabs/AgentsPlaygroundTab'
import McpExplorerTab from './components/tabs/McpExplorerTab'

export type TabId = 'activity' | 'moltbook' | 'usage' | 'skills' | 'editor' | 'cron' | 'trending' | 'agents' | 'mcp'

export default function App() {
  const [activeTab, setActiveTab] = useState<TabId>('activity')

  const renderTab = () => {
    switch (activeTab) {
      case 'activity': return <ActivityTab />
      case 'moltbook': return <MoltbookTab />
      case 'usage': return <UsageTab />
      case 'skills': return <SkillsTab />
      case 'editor': return <EditorTab />
      case 'cron': return <CronTab />
      case 'trending': return <GitHubTrendingTab />
      case 'agents': return <AgentsPlaygroundTab />
      case 'mcp': return <McpExplorerTab />
    }
  }

  return (
    <Layout activeTab={activeTab} onTabChange={setActiveTab}>
      {renderTab()}
    </Layout>
  )
}
