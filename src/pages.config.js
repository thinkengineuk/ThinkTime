import Dashboard from './pages/Dashboard';
import TicketDetail from './pages/TicketDetail';
import ClientPortal from './pages/ClientPortal';
import Settings from './pages/Settings';


export const PAGES = {
    "Dashboard": Dashboard,
    "TicketDetail": TicketDetail,
    "ClientPortal": ClientPortal,
    "Settings": Settings,
}

export const pagesConfig = {
    mainPage: "Dashboard",
    Pages: PAGES,
};